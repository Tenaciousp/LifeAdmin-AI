"""Check guest saved-plan privacy using separate HTTP cookies."""

from test_two_guest_http import TwoGuestHTTPTests
from unittest.mock import patch
import app


class GuestSavedPlanHTTPTests(TwoGuestHTTPTests):
    def test_two_guests_cannot_read_or_delete_private_plan(self):
        _, _, header_a = self.request("/api/notes")
        _, _, header_b = self.request("/api/notes")
        from http.cookies import SimpleCookie
        a, b = SimpleCookie(), SimpleCookie()
        a.load(header_a)
        b.load(header_b)
        cookie_a = "lifeadmin_guest=" + a["lifeadmin_guest"].value
        cookie_b = "lifeadmin_guest=" + b["lifeadmin_guest"].value
        self.assertNotEqual(cookie_a, cookie_b)
        with patch.object(app, "agent_rate_limited", return_value=False), \
             patch.object(app, "is_mode_unlocked", return_value=True), \
             patch.object(app, "call_openai", return_value=("Synthetic plan", "test")):
            status, result, _ = self.request(
                "/api/agent", {"task": {"title": "Private synthetic bill"}, "mode": "full"}, cookie_a
            )
        self.assertEqual(status, 200)
        note_id = result["note"]["id"]
        self.assertEqual(self.request("/api/notes", cookie=cookie_b)[1]["notes"], [])
        status, _, _ = self.request("/api/notes/delete", {"id": note_id}, cookie_b)
        self.assertEqual(status, 404)
        self.assertEqual(self.request("/api/notes", cookie=cookie_a)[1]["notes"][0]["id"], note_id)

    def test_saved_plan_survives_deletion_of_its_source_task(self):
        """A guest can reopen a saved result after removing its original task."""
        from http.cookies import SimpleCookie

        status, _, issued = self.request("/api/tasks")
        self.assertEqual(status, 200)
        guest = SimpleCookie()
        guest.load(issued)
        cookie = "lifeadmin_guest=" + guest["lifeadmin_guest"].value

        status, created, _ = self.request(
            "/api/tasks",
            {"title": "Synthetic renewal to delete", "category_id": "energy_water",
             "goal_id": "prepare_renewal"},
            cookie,
        )
        self.assertEqual(status, 201)
        task = created["task"]
        task_id = task["id"]

        with patch.object(app, "agent_rate_limited", return_value=False), \
             patch.object(app, "is_mode_unlocked", return_value=True), \
             patch.object(app, "call_openai", return_value=("Synthetic renewal plan", "test")):
            status, generated, _ = self.request(
                "/api/agent", {"task": task, "mode": "full"}, cookie
            )
        self.assertEqual(status, 200)
        original_note = generated["note"]
        self.assertEqual(original_note["task_id"], task_id)

        status, removed, _ = self.request(
            "/api/tasks/delete", {"id": task_id}, cookie
        )
        self.assertEqual(status, 200)
        self.assertEqual(removed, {"deleted": True, "id": task_id})

        status, tasks, _ = self.request("/api/tasks", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertNotIn(task_id, [item["id"] for item in tasks["tasks"]])

        status, saved, _ = self.request("/api/notes", cookie=cookie)
        self.assertEqual(status, 200)
        matching = [note for note in saved["notes"] if note["id"] == original_note["id"]]
        self.assertEqual(len(matching), 1)
        reopened = matching[0]
        for field in ("task_id", "title", "sections", "provider_email",
                      "known_details", "missing_details"):
            self.assertEqual(reopened[field], original_note[field])

