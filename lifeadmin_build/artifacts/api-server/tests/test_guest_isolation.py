import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch

import app


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


class GuestIsolationRegressionTests(unittest.TestCase):
    def test_caller_supplied_user_id_does_not_escape_guest_workspace(self):
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(app, "TASKS_FILE", os.path.join(tmpdir, "tasks.json")), \
             patch.object(app, "DEFAULT_TASKS", []), \
             patch.object(app, "current_user", return_value=None):

            with patch.object(app, "guest_session", return_value="guest-a"):
                create = _RouteHandler("/api/tasks", {
                    "title": "Private guest A task",
                    "category_id": "energy_water",
                    "goal_id": "check_bill",
                    "details": {"provider": "Example Energy"},
                    "user_id": "guest-b",
                })
                app.AdminPilotHandler.do_POST(create)
                self.assertEqual(create.status, 201)

            with patch.object(app, "guest_session", return_value="guest-b"):
                other_guest = _RouteHandler("/api/tasks")
                app.AdminPilotHandler.do_GET(other_guest)
                self.assertEqual(other_guest.status, 200)
                self.assertEqual(other_guest.payload()["tasks"], [])

            with patch.object(app, "guest_session", return_value="guest-a"):
                owner_guest = _RouteHandler("/api/tasks")
                app.AdminPilotHandler.do_GET(owner_guest)
                self.assertEqual(owner_guest.status, 200)
                self.assertEqual(owner_guest.payload()["tasks"][0]["title"], "Private guest A task")

    def test_guest_cannot_update_another_guests_task(self):
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(app, "TASKS_FILE", os.path.join(tmpdir, "tasks.json")), \
             patch.object(app, "DEFAULT_TASKS", []), \
             patch.object(app, "current_user", return_value=None):

            with patch.object(app, "guest_session", return_value="guest-a"):
                create = _RouteHandler("/api/tasks", {
                    "title": "Guest A task",
                    "category_id": "energy_water",
                    "goal_id": "check_bill",
                    "details": {},
                })
                app.AdminPilotHandler.do_POST(create)
                task_id = create.payload()["task"]["id"]

            with patch.object(app, "guest_session", return_value="guest-b"):
                update = _RouteHandler("/api/tasks/update", {
                    "id": task_id,
                    "title": "Changed by guest B",
                })
                app.AdminPilotHandler.do_POST(update)
                self.assertEqual(update.status, 404)

            with patch.object(app, "guest_session", return_value="guest-a"):
                owner_guest = _RouteHandler("/api/tasks")
                app.AdminPilotHandler.do_GET(owner_guest)
                self.assertEqual(owner_guest.payload()["tasks"][0]["title"], "Guest A task")

    def test_guest_cannot_delete_another_guests_task(self):
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(app, "TASKS_FILE", os.path.join(tmpdir, "tasks.json")), \
             patch.object(app, "DEFAULT_TASKS", []), \
             patch.object(app, "current_user", return_value=None):

            with patch.object(app, "guest_session", return_value="guest-a"):
                create = _RouteHandler("/api/tasks", {
                    "title": "Keep guest A task",
                    "category_id": "energy_water",
                    "goal_id": "check_bill",
                    "details": {},
                })
                app.AdminPilotHandler.do_POST(create)
                task_id = create.payload()["task"]["id"]

            with patch.object(app, "guest_session", return_value="guest-b"):
                delete = _RouteHandler("/api/tasks/delete", {"id": task_id})
                app.AdminPilotHandler.do_POST(delete)
                self.assertEqual(delete.status, 404)

            with patch.object(app, "guest_session", return_value="guest-a"):
                owner_guest = _RouteHandler("/api/tasks")
                app.AdminPilotHandler.do_GET(owner_guest)
                self.assertEqual(len(owner_guest.payload()["tasks"]), 1)
                self.assertEqual(owner_guest.payload()["tasks"][0]["id"], task_id)


if __name__ == "__main__":
    unittest.main()
