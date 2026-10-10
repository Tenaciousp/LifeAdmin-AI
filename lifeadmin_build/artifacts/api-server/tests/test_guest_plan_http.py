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
