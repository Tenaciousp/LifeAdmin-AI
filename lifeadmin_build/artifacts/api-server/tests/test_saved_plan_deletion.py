import io
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

import app
import storage


class _RouteHandler:
    def __init__(self, path, body=None):
        raw = json.dumps(body or {}).encode("utf-8")
        self.path = path
        self.headers = {"Content-Length": str(len(raw))}
        self.rfile = io.BytesIO(raw)
        self.wfile = io.BytesIO()
        self.client_address = ("test-client", 1)
        self.status = None
        self._guest_cookie = None

    def send_response(self, status):
        self.status = status

    def send_header(self, name, value):
        pass

    def end_headers(self):
        pass

    def payload(self):
        return json.loads(self.wfile.getvalue().decode("utf-8"))


class SavedPlanStorageDeletionTests(unittest.TestCase):
    def test_sqlite_deletion_requires_matching_owner(self):
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(storage, "SQLITE_PATH", pathlib.Path(tmpdir) / "lifeadmin.sqlite3"), \
             patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False):
            storage.ensure_schema()
            with storage.sqlite_connect() as conn:
                for user_id, email in (("owner-a", "a@example.com"), ("owner-b", "b@example.com")):
                    conn.execute(
                        "INSERT INTO adminpilot_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                        (user_id, email, "unused", "2026-10-03T00:00:00+00:00"),
                    )

            storage.add_note("owner-a", {"id": "plan-a", "title": "Private plan"})
            self.assertFalse(storage.delete_note("owner-b", "plan-a"))
            self.assertEqual(storage.list_notes("owner-a")[0]["id"], "plan-a")
            self.assertTrue(storage.delete_note("owner-a", "plan-a"))
            self.assertEqual(storage.list_notes("owner-a"), [])

    def test_registered_saved_plan_remains_private_after_task_deletion(self):
        """Deleting a registered user's task must not cascade-delete their plan."""
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(storage, "SQLITE_PATH", pathlib.Path(tmpdir) / "lifeadmin.sqlite3"), \
             patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False):
            storage.ensure_schema()
            with storage.sqlite_connect() as conn:
                for user_id, email in (("owner-a", "a@example.test"), ("owner-b", "b@example.test")):
                    conn.execute(
                        "INSERT INTO adminpilot_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                        (user_id, email, "synthetic", "2026-10-10T00:00:00+00:00"),
                    )

            task = {"id": "task-a", "title": "Synthetic energy renewal"}
            plan = {
                "id": "plan-a", "task_id": task["id"], "title": task["title"],
                "sections": {"next_steps": "Synthetic steps"},
                "provider_email": {"subject": "Synthetic request", "body": "Synthetic only"},
                "known_details": {"provider": "Fictional Energy"},
                "missing_details": ["renewal date"],
            }
            storage.create_task("owner-a", task)
            storage.add_note("owner-a", plan)
            self.assertTrue(storage.delete_task("owner-a", task["id"]))
            self.assertEqual(storage.list_tasks("owner-a"), [])
            self.assertEqual(storage.list_notes("owner-a"), [plan])
            self.assertEqual(storage.list_notes("owner-b"), [])
            self.assertFalse(storage.delete_note("owner-b", plan["id"]))
            self.assertEqual(storage.list_notes("owner-a"), [plan])

    def test_postgresql_and_sqlite_queries_both_match_owner_and_note(self):
        source = pathlib.Path(storage.__file__).read_text(encoding="utf-8")
        start = source.index("def delete_note")
        end = source.index("\n\ndef get_purchases", start)
        block = source[start:end]
        self.assertIn("WHERE user_id = %s AND id = %s", block)
        self.assertIn("WHERE user_id = ? AND id = ?", block)


class SavedPlanRouteDeletionTests(unittest.TestCase):
    def test_guest_cannot_delete_another_guests_saved_plan(self):
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(app, "NOTES_FILE", os.path.join(tmpdir, "notes.json")), \
             patch.object(app, "current_user", return_value=None):
            app.save_anonymous_items(app.NOTES_FILE, "guest-a", [{"id": "plan-a", "title": "Private"}])

            with patch.object(app, "guest_session", return_value="guest-b"):
                denied = _RouteHandler("/api/notes/delete", {"id": "plan-a"})
                app.AdminPilotHandler.do_POST(denied)
                self.assertEqual(denied.status, 404)

            with patch.object(app, "guest_session", return_value="guest-a"):
                deleted = _RouteHandler("/api/notes/delete", {"id": "plan-a"})
                app.AdminPilotHandler.do_POST(deleted)
                self.assertEqual(deleted.status, 200)
                self.assertEqual(deleted.payload(), {"deleted": True, "id": "plan-a"})

                remaining = _RouteHandler("/api/notes")
                app.AdminPilotHandler.do_GET(remaining)
                self.assertEqual(remaining.payload()["notes"], [])

    def test_signed_in_route_passes_authenticated_owner_to_storage(self):
        handler = _RouteHandler("/api/notes/delete", {"id": "plan-a"})
        with patch.object(app, "current_user", return_value={"id": "owner-a", "email": "a@example.com"}), \
             patch.object(app.storage, "delete_note", return_value=True) as delete_note:
            app.AdminPilotHandler.do_POST(handler)

        self.assertEqual(handler.status, 200)
        delete_note.assert_called_once_with("owner-a", "plan-a")


class SavedPlanFrontendDeletionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src"
        cls.journey = (root / "components" / "CustomerJourney.tsx").read_text(encoding="utf-8")
        cls.hooks = (root / "hooks" / "use-api.ts").read_text(encoding="utf-8")

    def test_delete_mutation_invalidates_only_current_saved_plan_query(self):
        start = self.hooks.index("export function useDeleteNote")
        end = self.hooks.index("\n\n// GET /api/tasks", start)
        block = self.hooks[start:end]
        self.assertIn('fetcher("/api/notes/delete"', block)
        self.assertIn('queryKey: ["/api/notes", variables.user_id]', block)
        self.assertNotIn("/api/tasks", block)

    def test_saved_plan_delete_control_is_labelled_and_separate_from_open(self):
        self.assertIn("handleDeleteSavedPlan(note)", self.journey)
        self.assertIn('aria-label={isDeleting ?', self.journey)
        self.assertIn('disabled={deleteNote.isPending}', self.journey)
        self.assertIn('className="flex items-stretch gap-2"', self.journey)

    def test_deleting_open_plan_clears_rendered_private_content(self):
        start = self.journey.index("const handleDeleteSavedPlan")
        end = self.journey.index("\n\n  const handleEditTask", start)
        block = self.journey[start:end]
        for phrase in (
            "selectedSavedPlanId === note.id",
            "setPlanResult(null)",
            "setProviderEmail(null)",
            "setLastKnownDetails([])",
            "setLastMissingDetails([])",
        ):
            self.assertIn(phrase, block)


if __name__ == "__main__":
    unittest.main()
