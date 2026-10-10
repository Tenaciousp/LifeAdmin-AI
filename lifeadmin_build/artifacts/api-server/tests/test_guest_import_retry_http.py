"""Synthetic account-bound guest-import retry through the real route handlers."""
import hashlib
import hmac
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app
from test_guest_isolation import _RouteHandler


class GuestImportRetryTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.patches = [
            patch.object(app, "TASKS_FILE", os.path.join(self.folder.name, "tasks.json")),
            patch.object(app, "NOTES_FILE", os.path.join(self.folder.name, "notes.json")),
            patch.object(app, "PURCHASES_FILE", os.path.join(self.folder.name, "purchases.json")),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.folder.cleanup()

    def cookie(self, guest_id):
        signature = hmac.new(app._SESSION_SECRET, guest_id.encode(), hashlib.sha256).hexdigest()
        return "lifeadmin_guest=" + guest_id + "." + signature

    def request(self, path, user, guest_id="guest-a", body=None):
        handler = _RouteHandler(path, body)
        handler.headers["Cookie"] = self.cookie(guest_id)
        with patch.object(app, "current_user", return_value=user):
            app.AdminPilotHandler._do_POST(handler)
        return handler.status, handler.payload()

    def test_import_status_requires_correct_account_and_signed_guest_cookie(self):
        app.set_pending_import_guest("account-a", "guest-a")
        user = {"id": "account-a"}
        good = SimpleNamespace(headers={"Cookie": self.cookie("guest-a")})
        other = SimpleNamespace(headers={"Cookie": self.cookie("guest-b")})
        bad = SimpleNamespace(headers={"Cookie": "lifeadmin_guest=guest-a.forged"})
        self.assertTrue(app.guest_import_status(good, user))
        self.assertFalse(app.guest_import_status(other, user))
        self.assertFalse(app.guest_import_status(bad, user))
        self.assertFalse(app.guest_import_status(good, {"id": "account-b"}))

    def test_retry_denies_other_accounts_and_other_guest_browsers(self):
        app.set_pending_import_guest("account-a", "guest-a")
        for user, guest, expected in (
            (None, "guest-a", 401),
            ({"id": "account-b"}, "guest-a", 403),
            ({"id": "account-a"}, "guest-b", 403),
        ):
            with self.subTest(user=user, guest=guest):
                status, _ = self.request("/api/auth/retry-guest-import", user, guest)
                self.assertEqual(status, expected)
        self.assertEqual(app.pending_import_guest("account-a"), "guest-a")

    def test_retry_preserves_failure_then_claims_work_once(self):
        app.save_anonymous_items(app.TASKS_FILE, "guest-a", [{"id": "task-1", "title": "Synthetic bill"}])
        app.save_anonymous_items(app.NOTES_FILE, "guest-a", [{"id": "plan-1", "title": "Synthetic plan"}])
        app.set_pending_import_guest("account-a", "guest-a")
        with patch.object(app.storage, "available", return_value=True), \
             patch.object(app.storage, "create_task", side_effect=[RuntimeError("synthetic outage"), None]) as tasks, \
             patch.object(app.storage, "add_note") as notes:
            status, result = self.request("/api/auth/retry-guest-import", {"id": "account-a"})
            self.assertEqual(status, 200)
            self.assertTrue(result["guest_import_pending"])
            self.assertEqual(len(app.anonymous_items(app.TASKS_FILE, "guest-a")), 1)
            self.assertEqual(app.anonymous_items(app.NOTES_FILE, "guest-a"), [])
            self.assertEqual(app.pending_import_guest("account-a"), "guest-a")
            status, result = self.request("/api/auth/retry-guest-import", {"id": "account-a"})
            self.assertEqual(status, 200)
            self.assertFalse(result["guest_import_pending"])
            self.assertEqual(app.anonymous_items(app.TASKS_FILE, "guest-a"), [])
            self.assertIsNone(app.pending_import_guest("account-a"))
            self.assertEqual(tasks.call_count, 2)
            notes.assert_called_once()
            self.assertEqual(self.request("/api/auth/retry-guest-import", {"id": "account-a"})[0], 403)

    def test_registration_reports_partial_migration_instead_of_claiming_success(self):
        app.save_anonymous_items(app.TASKS_FILE, "guest-a", [{"id": "task-1", "title": "Synthetic renewal"}])
        handler = _RouteHandler("/api/auth/register", {"email": "synthetic@example.test", "password": "example-only"})
        handler.headers["Cookie"] = self.cookie("guest-a")
        with patch.object(app, "current_user", return_value=None), \
             patch.object(app, "auth_rate_limited", return_value=False), \
             patch.object(app.storage, "create_user", return_value={"id": "account-a", "email": "synthetic@example.test"}), \
             patch.object(app.storage, "create_session", return_value="synthetic-token"), \
             patch.object(app.storage, "available", return_value=True), \
             patch.object(app.storage, "list_tasks", return_value=[]), \
             patch.object(app.storage, "list_notes", return_value=[]), \
             patch.object(app.storage, "create_task", side_effect=RuntimeError("synthetic outage")):
            app.AdminPilotHandler._do_POST(handler)
        self.assertEqual(handler.status, 201)
        self.assertTrue(handler.payload()["guest_import_pending"])
        self.assertEqual(app.pending_import_guest("account-a"), "guest-a")
        self.assertEqual(len(app.anonymous_items(app.TASKS_FILE, "guest-a")), 1)


if __name__ == "__main__":
    unittest.main()
