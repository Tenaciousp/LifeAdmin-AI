"""Synthetic recovery checks. No SMTP delivery, browser credentials or real accounts."""
import hashlib
import json
import os
import threading
import unittest
from unittest.mock import patch

import app
import password_recovery as recovery
import storage
import test_checkout_http as fixtures


class PasswordRecoveryTests(unittest.TestCase):
    request = fixtures.CheckoutHTTPTests.request
    register_owner = fixtures.CheckoutHTTPTests.register_owner
    tearDown = fixtures.CheckoutHTTPTests.tearDown

    def setUp(self):
        fixtures.CheckoutHTTPTests.setUp(self)
        guard = patch.dict(app._AUTH_RATE, {}, clear=True)
        guard.start()
        self.addCleanup(guard.stop)
        config = patch.dict(os.environ, {"PASSWORD_RECOVERY_ENABLED": "false"})
        config.start()
        self.addCleanup(config.stop)
        self.register_owner()

    def post(self, path, body):
        return self.request(self.owner_client, path, json.dumps(body).encode())

    def test_disabled_delivery_never_issues_a_token(self):
        with patch.object(recovery, "enqueue") as jobs:
            self.assertEqual(self.post("/api/auth/forgot-password", {"email": "synthetic-purchaser@example.test"})[0], 503)
            jobs.assert_not_called()

    def test_existing_and_unknown_email_get_identical_response(self):
        with patch.object(recovery, "configured", return_value=True), patch.object(recovery, "enqueue", return_value=True) as jobs:
            existing = self.post("/api/auth/forgot-password", {"email": "synthetic-purchaser@example.test"})
            absent = self.post("/api/auth/forgot-password", {"email": "absent@example.invalid"})
            self.assertEqual(existing, absent)
            self.assertEqual(existing[0], 202)
            self.assertEqual(jobs.call_count, 2)

    def test_request_rate_limit_and_delivery_queue_failure(self):
        with patch.object(recovery, "configured", return_value=True), patch.object(recovery, "enqueue", return_value=False):
            for _ in range(3):
                self.assertEqual(self.post("/api/auth/forgot-password", {"email": "absent@example.invalid"})[0], 503)
            self.assertEqual(self.post("/api/auth/forgot-password", {"email": "absent@example.invalid"})[0], 429)

    def test_single_use_reset_preserves_account_records_and_revokes_sessions(self):
        storage.unlock_purchase(self.owner_id, "core_app", "synthetic")
        storage.create_task(self.owner_id, {"id": "synthetic-task", "title": "Bill"})
        storage.add_note(self.owner_id, {"id": "synthetic-plan", "title": "Plan"})
        other = storage.create_user("other@example.invalid", "synthetic-other-password")
        other_session = storage.create_session(other["id"])
        _, token = storage.issue_password_reset("synthetic-purchaser@example.test")
        with storage.sqlite_connect() as conn:
            digest = conn.execute("SELECT token_hash FROM adminpilot_password_resets").fetchone()[0]
            self.assertEqual(digest, hashlib.sha256(token.encode()).hexdigest())
            self.assertNotEqual(digest, token)
        body = {"token": token, "password": "synthetic-new-password", "password_confirm": "synthetic-new-password", "user_id": other["id"]}
        with patch.object(recovery, "configured", return_value=True), patch.object(recovery, "enqueue", return_value=True):
            self.assertEqual(self.post("/api/auth/reset-password", body)[0], 200)
            self.assertEqual(self.post("/api/auth/reset-password", body)[0], 400)
        self.assertFalse(self.request(self.owner_client, "/api/auth/me")[1]["authenticated"])
        self.assertIsNotNone(storage.user_for_session(other_session))
        with self.assertRaises(ValueError):
            storage.authenticate("synthetic-purchaser@example.test", "synthetic-password-only")
        self.assertEqual(storage.authenticate("synthetic-purchaser@example.test", "synthetic-new-password")["id"], self.owner_id)
        self.assertTrue(storage.get_purchases(self.owner_id)["core_app"])
        self.assertEqual(len(storage.list_tasks(self.owner_id)), 1)
        self.assertEqual(len(storage.list_notes(self.owner_id)), 1)
        self.assertEqual(storage.authenticate("other@example.invalid", "synthetic-other-password")["id"], other["id"])

    def test_expiry_invalid_token_and_weak_password_do_not_change_account(self):
        _, token = storage.issue_password_reset("synthetic-purchaser@example.test")
        with self.assertRaises(ValueError):
            storage.reset_password(token, "short")
        with self.assertRaises(ValueError):
            storage.reset_password("x" * 43, "synthetic-new-password")
        with storage.sqlite_connect() as conn:
            conn.execute("UPDATE adminpilot_password_resets SET expires_at = ?", ("2000-01-01T00:00:00+00:00",))
        with self.assertRaises(ValueError):
            storage.reset_password(token, "synthetic-new-password")
        self.assertEqual(storage.authenticate("synthetic-purchaser@example.test", "synthetic-password-only")["id"], self.owner_id)

    def test_account_throttle_and_unknown_address(self):
        self.assertIsNone(storage.issue_password_reset("absent@example.invalid"))
        self.assertIsNotNone(storage.issue_password_reset("synthetic-purchaser@example.test"))
        self.assertIsNone(storage.issue_password_reset("synthetic-purchaser@example.test"))

    def test_confirmation_and_private_storage_error(self):
        with patch.object(recovery, "configured", return_value=True):
            self.assertEqual(self.post("/api/auth/reset-password", {"password": "synthetic-new-password", "password_confirm": "different"})[0], 400)
            with patch.object(storage, "reset_password", side_effect=RuntimeError("private-storage-detail")):
                status, body = self.post("/api/auth/reset-password", {"token": "x" * 43, "password": "synthetic-new-password", "password_confirm": "synthetic-new-password"})
                self.assertEqual(status, 503)
                self.assertNotIn("private-storage-detail", json.dumps(body))

    def test_mail_link_uses_fixed_https_origin_and_fragment(self):
        config = {"PASSWORD_RECOVERY_ENABLED": "true", "APP_BASE_URL": "https://app.example.invalid", "SMTP_HOST": "smtp.example.invalid", "SMTP_USERNAME": "synthetic", "SMTP_PASSWORD": "synthetic", "SMTP_FROM": "support@example.invalid"}
        with patch.dict(os.environ, config), patch.object(recovery, "send_mail") as send:
            recovery.process_job("request", "synthetic-purchaser@example.test")
            self.assertEqual(send.call_count, 1)
            self.assertIn("https://app.example.invalid/#reset=", send.call_args.args[2])
            recovery.process_job("request", "absent@example.invalid")
            self.assertEqual(send.call_count, 1)
            with patch.dict(os.environ, {"APP_BASE_URL": "http://app.example.invalid"}):
                self.assertFalse(recovery.configured())

    def test_competing_links_have_only_one_success(self):
        _, first = storage.issue_password_reset("synthetic-purchaser@example.test")
        with storage.sqlite_connect() as conn:
            conn.execute("UPDATE adminpilot_password_resets SET created_at = ?", ("2000-01-01T00:00:00+00:00",))
        _, second = storage.issue_password_reset("synthetic-purchaser@example.test")
        barrier = threading.Barrier(2)
        outcomes = []
        def attempt(token):
            barrier.wait(timeout=3)
            try:
                storage.reset_password(token, "synthetic-new-password")
                outcomes.append("changed")
            except ValueError:
                outcomes.append("rejected")
        threads = [threading.Thread(target=attempt, args=(token,)) for token in (first, second)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=5)
            self.assertFalse(thread.is_alive())
        self.assertCountEqual(outcomes, ["changed", "rejected"])

    def test_database_failure_rolls_back_password_and_token(self):
        _, token = storage.issue_password_reset("synthetic-purchaser@example.test")
        with storage.sqlite_connect() as conn:
            conn.executescript("CREATE TRIGGER synthetic_reset_failure BEFORE DELETE ON adminpilot_sessions BEGIN SELECT RAISE(ABORT, 'synthetic rollback'); END;")
        with self.assertRaises(Exception):
            storage.reset_password(token, "synthetic-new-password")
        self.assertEqual(storage.authenticate("synthetic-purchaser@example.test", "synthetic-password-only")["id"], self.owner_id)
        with storage.sqlite_connect() as conn:
            conn.execute("DROP TRIGGER synthetic_reset_failure")
        self.assertEqual(storage.reset_password(token, "synthetic-new-password"), "synthetic-purchaser@example.test")


if __name__ == "__main__":
    unittest.main()
