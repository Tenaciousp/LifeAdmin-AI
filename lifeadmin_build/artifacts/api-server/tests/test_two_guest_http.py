"""Two-browser guest isolation over the real HTTP request path.

All writes use disposable temporary files; no account or production data is used.
"""

from contextlib import nullcontext
from http.server import ThreadingHTTPServer
from http.cookies import SimpleCookie
import json
import os
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


class TwoGuestHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.tasks_patch = patch.object(
            app, "TASKS_FILE", os.path.join(self.temp.name, "tasks.json")
        )
        self.notes_patch = patch.object(
            app, "NOTES_FILE", os.path.join(self.temp.name, "notes.json")
        )
        self.auth_patch = patch.object(app, "current_user", return_value=None)
        self.lock_patch = patch.object(
            app, "data_lock", side_effect=lambda *args, **kwargs: nullcontext()
        )
        for item in (self.tasks_patch, self.notes_patch, self.auth_patch, self.lock_patch):
            item.start()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.AdminPilotHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        for item in (self.lock_patch, self.auth_patch, self.notes_patch, self.tasks_patch):
            item.stop()
        self.temp.cleanup()

    def request(self, path, body=None, cookie=None):
        headers = {"Cookie": cookie} if cookie else {}
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}{path}",
            data=data,
            headers=headers,
        )
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, json.load(response), response.headers.get("Set-Cookie")

    def test_two_guests_cannot_read_update_or_delete_each_others_tasks(self):
        status, _, issued_a = self.request("/api/tasks")
        self.assertEqual(status, 200)
        self.assertIsNotNone(issued_a)
        a = SimpleCookie()
        a.load(issued_a)
        cookie_a = f"lifeadmin_guest={a['lifeadmin_guest'].value}"

        status, created, _ = self.request(
            "/api/tasks", {"title": "Guest A private renewal"}, cookie_a
        )
        self.assertEqual(status, 201)
        task_id = created["task"]["id"]

        status, initial_b, issued_b = self.request("/api/tasks")
        self.assertEqual(status, 200)
        self.assertEqual(initial_b["tasks"], [])
        self.assertIsNotNone(issued_b)
        b = SimpleCookie()
        b.load(issued_b)
        cookie_b = f"lifeadmin_guest={b['lifeadmin_guest'].value}"
        self.assertNotEqual(cookie_a, cookie_b)

        status, denied, _ = self.request(
            "/api/tasks/update", {"id": task_id, "status": "Done"}, cookie_b
        )
        self.assertEqual(status, 404)
        self.assertEqual(denied["error"], "Task not found")

        status, denied, _ = self.request(
            "/api/tasks/delete", {"id": task_id}, cookie_b
        )
        self.assertEqual(status, 404)
        self.assertEqual(denied["error"], "Task not found")

        status, a_items, _ = self.request("/api/tasks", cookie=cookie_a)
        self.assertEqual(status, 200)
        self.assertEqual(len(a_items["tasks"]), 1)
        self.assertEqual(a_items["tasks"][0]["id"], task_id)
        self.assertEqual(a_items["tasks"][0]["status"], "Open")

        status, b_items, _ = self.request("/api/tasks", cookie=cookie_b)
        self.assertEqual(status, 200)
        self.assertEqual(b_items["tasks"], [])


if __name__ == "__main__":
    unittest.main()
