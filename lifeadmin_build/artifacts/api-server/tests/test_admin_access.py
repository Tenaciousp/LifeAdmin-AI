"""Regression checks for administrator allowlist enforcement.

These tests use synthetic identities only and never configure a real administrator.
"""

import os
import unittest
from unittest.mock import patch

import app


class AdminAccessTests(unittest.TestCase):
    def test_no_allowlist_denies_even_authenticated_users(self):
        with patch.dict(os.environ, {"ADMIN_EMAILS": ""}):
            self.assertFalse(app.is_admin({"id": "user-1", "email": "owner@example.test"}))
            self.assertIsNone(app.admin_overview({"id": "user-1", "email": "owner@example.test"}))

    def test_missing_user_is_never_admin(self):
        with patch.dict(os.environ, {"ADMIN_EMAILS": "owner@example.test"}):
            self.assertFalse(app.is_admin(None))
            self.assertIsNone(app.admin_overview(None))

    def test_non_admin_cannot_read_aggregate_data(self):
        with patch.dict(os.environ, {"ADMIN_EMAILS": "owner@example.test"}):
            with patch.object(app.storage, "admin_overview") as aggregate:
                self.assertIsNone(app.admin_overview({"id": "customer-1", "email": "customer@example.test"}))
                aggregate.assert_not_called()

    def test_allowlisted_email_matches_case_insensitively(self):
        with patch.dict(os.environ, {"ADMIN_EMAILS": " first@example.test, OWNER@EXAMPLE.TEST "}):
            self.assertTrue(app.is_admin({"id": "admin-1", "email": "owner@example.test"}))
            self.assertTrue(app.is_admin({"id": "admin-2", "email": "first@example.test"}))
            self.assertFalse(app.is_admin({"id": "customer-1", "email": "other@example.test"}))

    def test_authorised_user_can_read_aggregate_overview(self):
        expected = {"users": {"total": 2}, "tasks": {"total": 3}}
        with patch.dict(os.environ, {"ADMIN_EMAILS": "owner@example.test"}):
            with patch.object(app.storage, "available", return_value=True):
                with patch.object(app.storage, "admin_overview", return_value=expected) as aggregate:
                    self.assertEqual(
                        app.admin_overview({"id": "admin-1", "email": "owner@example.test"}),
                        expected,
                    )
                    aggregate.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
