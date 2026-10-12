"""SMTP protocol and sanitized failure tests; no external connections or emails."""
import os
import queue
import ssl
import unittest
from unittest.mock import Mock, patch

import password_recovery as recovery


class RecoveryDeliveryTests(unittest.TestCase):
    def setUp(self):
        config = patch.dict(os.environ, {
            "PASSWORD_RECOVERY_ENABLED": "true", "APP_BASE_URL": "https://app.example.invalid",
            "SMTP_HOST": "smtp.example.invalid", "SMTP_PORT": "465", "SMTP_SECURITY": "ssl",
            "SMTP_USERNAME": "synthetic-user", "SMTP_PASSWORD": "synthetic-secret",
            "SMTP_FROM": "support@example.invalid",
        })
        config.start()
        self.addCleanup(config.stop)

    def test_implicit_tls_verifies_certificates_and_authenticates(self):
        with patch.object(recovery.smtplib, "SMTP_SSL") as secure, patch.object(recovery.smtplib, "SMTP") as plain:
            recovery.send_mail("owner@example.invalid", "Synthetic", "Synthetic body")
            plain.assert_not_called()
            context = secure.call_args.kwargs["context"]
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
            smtp = secure.return_value.__enter__.return_value
            smtp.login.assert_called_once_with("synthetic-user", "synthetic-secret")
            smtp.send_message.assert_called_once()

    def test_starttls_upgrade_precedes_authentication(self):
        with patch.dict(os.environ, {"SMTP_SECURITY": "starttls", "SMTP_PORT": "587"}), patch.object(recovery.smtplib, "SMTP") as plain, patch.object(recovery.smtplib, "SMTP_SSL") as secure:
            recovery.send_mail("owner@example.invalid", "Synthetic", "Synthetic body")
            secure.assert_not_called()
            self.assertEqual(plain.call_args.args, ("smtp.example.invalid", 587))
            smtp = plain.return_value.__enter__.return_value
            self.assertEqual([call[0] for call in smtp.mock_calls], ["ehlo", "starttls", "ehlo", "login", "send_message"])
            context = smtp.starttls.call_args.kwargs["context"]
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)

    def test_failed_tls_never_sends_credentials_or_mail(self):
        with patch.dict(os.environ, {"SMTP_SECURITY": "starttls", "SMTP_PORT": "587"}), patch.object(recovery.smtplib, "SMTP") as plain:
            smtp = plain.return_value.__enter__.return_value
            smtp.starttls.side_effect = ssl.SSLError("synthetic TLS failure")
            with self.assertRaises(ssl.SSLError):
                recovery.send_mail("owner@example.invalid", "Synthetic", "Synthetic body")
            smtp.login.assert_not_called()
            smtp.send_message.assert_not_called()

    def test_invalid_mode_or_port_disables_recovery(self):
        for config in ({"SMTP_SECURITY": "none"}, {"SMTP_SECURITY": "automatic"},
                       {"SMTP_PORT": "not-a-port"}, {"SMTP_PORT": "0"}, {"SMTP_PORT": "65536"}):
            with self.subTest(config=config), patch.dict(os.environ, config):
                self.assertFalse(recovery.configured())

    def test_worker_failure_is_sanitized_and_completes_queue_job(self):
        jobs = Mock()
        jobs.get.side_effect = [("request", "owner@example.invalid"), StopIteration]
        with patch.object(recovery, "_jobs", jobs), patch.object(recovery, "process_job", side_effect=RuntimeError("owner@example.invalid synthetic-secret token=synthetic-token")), self.assertLogs("password_recovery", level="WARNING") as logs:
            with self.assertRaises(StopIteration):
                recovery._run()
        jobs.task_done.assert_called_once()
        output = " ".join(logs.output)
        self.assertIn("delivery failed", output)
        for sensitive in ("owner@example.invalid", "synthetic-secret", "synthetic-token"):
            self.assertNotIn(sensitive, output)

    def test_full_queue_warning_has_no_recipient_details(self):
        jobs = Mock()
        jobs.put_nowait.side_effect = queue.Full
        worker = Mock()
        worker.is_alive.return_value = True
        with patch.object(recovery, "_jobs", jobs), patch.object(recovery, "_worker", worker), self.assertLogs("password_recovery", level="WARNING") as logs:
            self.assertFalse(recovery.enqueue("changed", "owner@example.invalid"))
        self.assertNotIn("owner@example.invalid", " ".join(logs.output))


if __name__ == "__main__":
    unittest.main()
