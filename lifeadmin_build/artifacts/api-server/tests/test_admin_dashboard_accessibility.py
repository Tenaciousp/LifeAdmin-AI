import os
import pathlib
import unittest
from unittest.mock import patch

import app


DASHBOARD_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "pages" / "AdminDashboard.tsx"
DASHBOARD = DASHBOARD_PATH.read_text(encoding="utf-8")


class AdminDashboardProtectionTests(unittest.TestCase):
    def test_admin_authorisation_is_deny_by_default(self):
        self.assertFalse(app.is_admin(None))
        with patch.dict(os.environ, {"ADMIN_EMAILS": ""}, clear=False):
            self.assertFalse(app.is_admin({"email": "owner@example.com"}))
        with patch.dict(os.environ, {"ADMIN_EMAILS": "owner@example.com"}, clear=False):
            self.assertTrue(app.is_admin({"email": "OWNER@example.com"}))

    def test_non_admin_overview_returns_no_metrics(self):
        self.assertIsNone(app.admin_overview(None))


class AdminDashboardErrorStateTests(unittest.TestCase):
    def test_access_denial_is_not_used_for_network_or_server_failures(self):
        for phrase in (
            'error instanceof Error && error.message === "Admin access required"',
            'accessDenied ? "Admin access required" : "Dashboard unavailable"',
            "The dashboard could not be loaded. Check your connection and try again.",
        ):
            self.assertIn(phrase, DASHBOARD)

    def test_transient_failure_offers_retry_without_weakening_access_control(self):
        self.assertIn("refetch: retryDashboard", DASHBOARD)
        self.assertIn('onClick={() => void retryDashboard()}', DASHBOARD)
        self.assertIn("Retry dashboard", DASHBOARD)
        self.assertIn('href="/#account"', DASHBOARD)
        self.assertIn('role="alert"', DASHBOARD)

    def test_activity_table_has_caption_and_column_scopes(self):
        self.assertIn("<caption", DASHBOARD)
        self.assertIn("Recent privacy-light operational activity", DASHBOARD)
        self.assertEqual(DASHBOARD.count('scope="col"'), 3)


if __name__ == "__main__":
    unittest.main()
