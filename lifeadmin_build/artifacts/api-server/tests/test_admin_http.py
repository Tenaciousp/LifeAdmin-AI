"""Loopback HTTP checks for protected administrator routes.

Identity is mocked only inside these tests. This is not a substitute for
browser-based authentication QA with an actual account.
"""

from contextlib import nullcontext
from http.server import ThreadingHTTPServer
import json
import os
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import app


class AdminHTTPTests(unittest.TestCase):
    def setUp(self):
        self.allowed = patch.dict(os.environ, {"ADMIN_EMAILS": "owner@example.test"})
        self.allowed.start()
        self.identity = patch.object(
            app,
            "current_user",
            side_effect=lambda handler: (
                {"id": "admin", "email": "owner@example.test"}
                if handler.headers.get("X-Synthetic-Identity") == "admin"
                else {"id": "customer", "email": "customer@example.test"}
                if handler.headers.get("X-Synthetic-Identity") == "customer"
                else None
            ),
        )
        self.identity.start()
        self.guest = patch.object(app, "guest_session", return_value="synthetic-guest")
        self.guest.start()
        self.lock = patch.object(app, "data_lock", side_effect=lambda *a, **kw: nullcontext())
        self.lock.start()
        self.available = patch.object(app.storage, "available", return_value=True)
        self.available.start()
        self.overview = patch.object(
            app.storage, "admin_overview", return_value={"users": {"total": 2}}
        )
        self.overview_mock = self.overview.start()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.AdminPilotHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.overview.stop()
        self.available.stop()
        self.lock.stop()
        self.guest.stop()
        self.identity.stop()
        self.allowed.stop()

    def get(self, path, identity=None):
        headers = {"X-Synthetic-Identity": identity} if identity else {}
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}{path}", headers=headers
        )
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as exc:
            with exc:
                return exc.code, json.load(exc)

    def test_guest_and_customer_receive_http_403(self):
        for identity in (None, "customer"):
            with self.subTest(identity=identity):
                status, body = self.get("/api/admin/overview", identity)
                self.assertEqual(status, 403)
                self.assertEqual(body["error"], "Admin access required")
        self.overview_mock.assert_not_called()

    def test_authorised_admin_receives_http_200(self):
        status, body = self.get("/api/admin/overview", "admin")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"users": {"total": 2}})
        self.overview_mock.assert_called_once_with()

    def test_admin_database_failure_is_retryable_without_leaking_details(self):
        self.overview_mock.side_effect = [
            RuntimeError("synthetic private database details"),
            {"users": {"total": 2}},
        ]
        status, failed = self.get("/api/admin/overview", "admin")
        self.assertEqual(status, 503)
        self.assertEqual(
            failed["error"],
            "Administrator statistics are temporarily unavailable. Please retry.",
        )
        self.assertNotIn("synthetic private database details", str(failed))

        status, recovered = self.get("/api/admin/overview", "admin")
        self.assertEqual(status, 200)
        self.assertEqual(recovered, {"users": {"total": 2}})
        self.assertEqual(self.overview_mock.call_count, 2)

    def test_settings_route_also_denies_non_admin(self):
        status, body = self.get("/api/settings", "customer")
        self.assertEqual(status, 403)
        self.assertEqual(body["error"], "Admin access required")


if __name__ == "__main__":
    unittest.main()
