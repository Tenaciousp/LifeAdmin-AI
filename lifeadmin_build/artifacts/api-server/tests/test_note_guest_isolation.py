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


class GuestNoteIsolationTests(unittest.TestCase):
    def test_generated_notes_stay_in_the_issuing_guest_workspace(self):
        with tempfile.TemporaryDirectory() as tmpdir, \
             patch.object(app, "NOTES_FILE", os.path.join(tmpdir, "notes.json")), \
             patch.object(app, "current_user", return_value=None), \
             patch.object(app, "agent_rate_limited", return_value=False), \
             patch.object(app, "is_mode_unlocked", return_value=True), \
             patch.object(
                 app,
                 "call_openai",
                 side_effect=lambda supplied_task, mode: (
                     app.fallback_agent(supplied_task, mode),
                     "fallback",
                 ),
             ):
            task = {
                "id": "guest-a-plan",
                "title": "Private renewal plan",
                "category_id": "energy_water",
                "goal_id": "prepare_renewal",
                "details": {"provider": "Example Energy"},
            }

            with patch.object(app, "guest_session", return_value="guest-a"):
                generate = _RouteHandler("/api/agent", {"task": task, "mode": "full"})
                app.AdminPilotHandler.do_POST(generate)
                self.assertEqual(generate.status, 200)
                note_id = generate.payload()["note"]["id"]

            with patch.object(app, "guest_session", return_value="guest-b"):
                other_guest = _RouteHandler("/api/notes")
                app.AdminPilotHandler.do_GET(other_guest)
                self.assertEqual(other_guest.status, 200)
                self.assertEqual(other_guest.payload()["notes"], [])

            with patch.object(app, "guest_session", return_value="guest-a"):
                owner_guest = _RouteHandler("/api/notes")
                app.AdminPilotHandler.do_GET(owner_guest)
                self.assertEqual(owner_guest.status, 200)
                self.assertEqual(owner_guest.payload()["notes"][0]["id"], note_id)

    def test_invalid_guest_cookie_is_replaced_with_a_new_identity(self):
        handler = _RouteHandler("/api/tasks")
        handler.headers["Cookie"] = "lifeadmin_guest=chosen-workspace.invalid"

        identity = app.guest_session(handler)

        self.assertNotEqual(identity, "chosen-workspace")
        self.assertRegex(identity, r"^[0-9a-f]{32}$")
        self.assertIsNotNone(handler._guest_cookie)
        self.assertIn("lifeadmin_guest=", handler._guest_cookie)


if __name__ == "__main__":
    unittest.main()
