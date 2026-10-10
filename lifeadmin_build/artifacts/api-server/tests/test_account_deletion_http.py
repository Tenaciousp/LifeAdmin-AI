"""Real HTTP account lifecycle regression with disposable SQLite storage."""

from contextlib import nullcontext
from http.server import ThreadingHTTPServer
from http.cookies import SimpleCookie
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app
import storage


class AccountDeletionHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.patches = [
            patch.dict(os.environ, {"DATABASE_URL": ""}),
            patch.object(storage, "SQLITE_PATH", Path(self.temp.name) / "accounts.sqlite3"),
            patch.object(app, "TASKS_FILE", os.path.join(self.temp.name, "tasks.json")),
            patch.object(app, "NOTES_FILE", os.path.join(self.temp.name, "notes.json")),
            patch.object(app, "PURCHASES_FILE", os.path.join(self.temp.name, "purchases.json")),
            patch.object(app, "data_lock", side_effect=lambda *a, **kw: nullcontext()),
            patch.object(app, "auth_rate_limited", return_value=False),
        ]
        for p in self.patches:
            p.start()
        storage.ensure_schema()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.AdminPilotHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def request(self, path, body=None, cookie=None):
        headers = {"Cookie": cookie} if cookie else {}
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = Request(
            f"http://127.0.0.1:{self.server.server_port}{path}",
            data=data,
            headers=headers,
        )
        try:
            resp = urlopen(req, timeout=5)
        except HTTPError as exc:
            resp = exc
        with resp:
            return resp.status, json.load(resp), resp.headers.get("Set-Cookie")

    def test_permanent_deletion_revokes_session_and_rejects_old_credentials(self):
        email = "disposable@example.test"
        password = "synthetic-password-123"
        status, created, set_cookie = self.request(
            "/api/auth/register", {"email": email, "password": password}
        )
        self.assertEqual(status, 201)
        self.assertTrue(created["authenticated"])
        cookie = SimpleCookie()
        cookie.load(set_cookie)
        session = f"adminpilot_session={cookie['adminpilot_session'].value}"

        status, task, _ = self.request(
            "/api/tasks", {"title": "Disposable private task"}, session
        )
        self.assertEqual(status, 201)
        self.assertEqual(task["task"]["title"], "Disposable private task")

        status, denied, _ = self.request(
            "/api/auth/delete", {"password": "incorrect-password"}, session
        )
        self.assertEqual(status, 403)
        self.assertIn("error", denied)

        status, still_signed_in, _ = self.request("/api/auth/me", cookie=session)
        self.assertEqual(status, 200)
        self.assertTrue(still_signed_in["authenticated"])

        status, deleted, cleared_cookie = self.request(
            "/api/auth/delete", {"password": password}, session
        )
        self.assertEqual(status, 200)
        self.assertEqual(deleted, {"deleted": True})
        self.assertIn("Max-Age=0", cleared_cookie)

        status, former_session, _ = self.request("/api/auth/me", cookie=session)
        self.assertEqual(status, 200)
        self.assertFalse(former_session["authenticated"])

        status, refused, _ = self.request(
            "/api/auth/login", {"email": email, "password": password}
        )
        self.assertEqual(status, 401)
        self.assertIn("error", refused)

    def test_deleting_one_account_purges_its_records_without_harming_another(self):
        """Account deletion cascades through private data, not other accounts."""
        credentials = [
            ("first@example.test", "synthetic-password-first"),
            ("second@example.test", "synthetic-password-second"),
        ]
        accounts = []
        for email, password in credentials:
            status, created, set_cookie = self.request(
                "/api/auth/register", {"email": email, "password": password}
            )
            self.assertEqual(status, 201)
            cookie = SimpleCookie()
            cookie.load(set_cookie)
            accounts.append((
                created["user"]["id"],
                f"adminpilot_session={cookie['adminpilot_session'].value}",
            ))

        for index, (user_id, _) in enumerate(accounts):
            task = {"id": f"task-{index}", "title": f"Synthetic task {index}"}
            note = {"id": f"note-{index}", "task_id": task["id"],
                    "title": task["title"], "sections": {"next_steps": "Synthetic only"}}
            storage.create_task(user_id, task)
            storage.add_note(user_id, note)
            storage.unlock_purchase(user_id, "core_app", "synthetic-test")

        deleted_user, deleted_cookie = accounts[0]
        kept_user, kept_cookie = accounts[1]
        status, result, _ = self.request(
            "/api/auth/delete", {"password": credentials[0][1]}, deleted_cookie
        )
        self.assertEqual(status, 200)
        self.assertEqual(result, {"deleted": True})
        self.assertEqual(storage.list_tasks(deleted_user), [])
        self.assertEqual(storage.list_notes(deleted_user), [])
        self.assertEqual(storage.get_purchases(deleted_user), {})

        status, former_auth, _ = self.request("/api/auth/me", cookie=deleted_cookie)
        self.assertEqual(status, 200)
        self.assertFalse(former_auth["authenticated"])
        status, remaining_auth, _ = self.request("/api/auth/me", cookie=kept_cookie)
        self.assertEqual(status, 200)
        self.assertTrue(remaining_auth["authenticated"])
        self.assertEqual(remaining_auth["user"]["id"], kept_user)
        self.assertEqual([task["id"] for task in storage.list_tasks(kept_user)], ["task-1"])
        self.assertEqual([note["id"] for note in storage.list_notes(kept_user)], ["note-1"])
        self.assertEqual(storage.get_purchases(kept_user), {"core_app": True})


if __name__ == "__main__":
    unittest.main()
