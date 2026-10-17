"""Synthetic startup preflight. No provider calls, real keys or server binding."""
import io
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import app
import storage


class ProductionStartupTests(unittest.TestCase):
    def setUp(self):
        config = patch.dict(os.environ, {
            "APP_ENV": "production", "SESSION_SECRET": "synthetic-production-secret-only-123456789",
            "STRIPE_SECRET_KEY": "", "PAID_ACCESS_REQUIRED": "true", "DEMO_PAYMENTS": "false",
            "PASSWORD_RECOVERY_ENABLED": "false", "APP_BASE_URL": "",
            "DATABASE_URL": "", "STRIPE_WEBHOOK_SECRET": "", "STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP": "",
            "STRIPE_PRICE_LIFEADMIN_COMPLETE": "", "SMTP_HOST": "", "SMTP_USERNAME": "", "SMTP_PASSWORD": "", "SMTP_FROM": "",
        }, clear=True)
        config.start()
        self.addCleanup(config.stop)

    def test_missing_short_and_whitespace_secrets_fail_before_data_or_server(self):
        for value in ("", "short", " " * 40, "x" * 31, "x" * 16 + " " + "y" * 16):
            with self.subTest(length=len(value)), patch.dict(os.environ, {"SESSION_SECRET": value}), patch.object(app, "ensure_data") as data, patch.object(app, "ThreadingHTTPServer") as server:
                with self.assertRaisesRegex(RuntimeError, "SESSION_SECRET"):
                    app.main()
                data.assert_not_called()
                server.assert_not_called()

    def test_demo_and_unpaid_live_modes_are_refused(self):
        with patch.dict(os.environ, {"DEMO_PAYMENTS": "true"}):
            with self.assertRaisesRegex(RuntimeError, "DEMO_PAYMENTS"):
                app.validate_production_configuration()
        for key in ("sk_live_synthetic", "rk_live_synthetic"):
            with patch.dict(os.environ, {"STRIPE_SECRET_KEY": key, "PAID_ACCESS_REQUIRED": "false"}):
                with self.assertRaisesRegex(RuntimeError, "PAID_ACCESS_REQUIRED"):
                    app.validate_production_configuration()

    def test_live_payments_require_a_fixed_https_origin(self):
        for url in ("", "http://app.example.invalid", "https://user:secret@app.example.invalid", "https://app.example.invalid/path", "https://app.example.invalid/?secret=synthetic", "https://app.example.invalid/#fragment", "https://app.example.invalid:bad", "https://[bad", "https://app .example.invalid", "https://app.example.invalid\r\n", "\x01https://app.example.invalid"):
            with self.subTest(url=url), patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_live_synthetic", "APP_BASE_URL": url}):
                with self.assertRaisesRegex(RuntimeError, "HTTPS app origin") as failure:
                    app.validate_production_configuration()
                self.assertNotIn("user:secret", str(failure.exception))

    def test_live_payments_require_webhook_and_price_then_accept_reviewed_shape(self):
        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_live_synthetic", "APP_BASE_URL": "https://app.example.invalid"}):
            with self.assertRaisesRegex(RuntimeError, "webhook secret"):
                app.validate_production_configuration()
            with patch.dict(os.environ, {"STRIPE_WEBHOOK_SECRET": "synthetic-webhook"}):
                with self.assertRaisesRegex(RuntimeError, "GBP Price"):
                    app.validate_production_configuration()
                with patch.dict(os.environ, {"STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP": "price_synthetic"}):
                    app.validate_production_configuration()

    def test_enabled_recovery_requires_https_and_complete_encrypted_sender(self):
        with patch.dict(os.environ, {"PASSWORD_RECOVERY_ENABLED": "true"}):
            with self.assertRaisesRegex(RuntimeError, "HTTPS app origin"):
                app.validate_production_configuration()
            with patch.dict(os.environ, {"APP_BASE_URL": "https://app.example.invalid"}):
                with self.assertRaisesRegex(RuntimeError, "SMTP"):
                    app.validate_production_configuration()
                sender = {"SMTP_HOST": "smtp.example.invalid", "SMTP_USERNAME": "synthetic", "SMTP_PASSWORD": "synthetic", "SMTP_FROM": "support@example.invalid", "SMTP_SECURITY": "starttls", "SMTP_PORT": "587"}
                with patch.dict(os.environ, sender):
                    app.validate_production_configuration()

    def test_unavailable_storage_fails_preflight(self):
        with patch.object(storage, "available", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "storage is unavailable"):
                app.validate_production_configuration()

    def test_schema_failure_stops_production_without_private_error_or_binding(self):
        with patch.object(app, "ensure_data"), patch.object(storage, "ensure_schema", side_effect=RuntimeError("synthetic-private-connection-secret")), patch.object(app, "ThreadingHTTPServer") as server, redirect_stdout(io.StringIO()) as output:
            with self.assertRaisesRegex(RuntimeError, "startup stopped") as failure:
                app.main()
            self.assertNotIn("synthetic-private", str(failure.exception) + output.getvalue())
            self.assertTrue(failure.exception.__suppress_context__)
            server.assert_not_called()

    def test_private_development_and_no_payment_docker_checks_remain_supported(self):
        app.validate_production_configuration()
        with patch.dict(os.environ, {"APP_ENV": "development", "SESSION_SECRET": "", "DEMO_PAYMENTS": "true"}):
            app.validate_production_configuration()


if __name__ == "__main__":
    unittest.main()
