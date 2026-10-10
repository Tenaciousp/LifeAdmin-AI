"""Regression checks for server-issued guest sessions and cookie security."""

import hashlib
import hmac
import unittest
from http.cookies import SimpleCookie
from types import SimpleNamespace
from unittest.mock import patch

import app


class GuestSessionSecurityTests(unittest.TestCase):
    def handler(self, cookie="", scheme="http"):
        return SimpleNamespace(headers={"Cookie": cookie, "X-Forwarded-Proto": scheme})

    def signed_token(self, guest_id):
        signature = hmac.new(
            app._SESSION_SECRET, guest_id.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        return f"{guest_id}.{signature}"

    def test_valid_signed_guest_cookie_preserves_workspace(self):
        guest_id = "a" * 32
        handler = self.handler(f"lifeadmin_guest={self.signed_token(guest_id)}")
        self.assertEqual(app.guest_session(handler), guest_id)
        self.assertFalse(hasattr(handler, "_guest_cookie"))

    def test_tampered_guest_cookie_gets_new_workspace(self):
        original = "a" * 32
        tampered = "b" + original[1:]
        signature = self.signed_token(original).split(".", 1)[1]
        handler = self.handler(f"lifeadmin_guest={tampered}.{signature}")
        issued_id = app.guest_session(handler)
        self.assertNotEqual(issued_id, tampered)
        self.assertNotEqual(issued_id, original)
        self.assertEqual(len(issued_id), 32)
        issued_cookie = SimpleCookie()
        issued_cookie.load(handler._guest_cookie)
        self.assertEqual(
            issued_cookie["lifeadmin_guest"].value,
            self.signed_token(issued_id),
        )

    def test_unsigned_caller_supplied_workspace_is_rejected(self):
        handler = self.handler("lifeadmin_guest=attacker_selected")
        self.assertNotEqual(app.guest_session(handler), "attacker_selected")
        self.assertIn("lifeadmin_guest=", handler._guest_cookie)

    def test_http_cookie_is_httponly_and_samesite_without_secure(self):
        cookie = app.session_cookie(self.handler(), "test-token")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertNotIn("; Secure", cookie)

    def test_https_cookie_has_secure_flag(self):
        handler = self.handler(scheme="https")
        for name in ("adminpilot_session", "lifeadmin_guest"):
            with self.subTest(name=name):
                cookie = app.session_cookie(handler, "test-token", name=name)
                self.assertIn("HttpOnly", cookie)
                self.assertIn("SameSite=Lax", cookie)
                self.assertIn("; Secure", cookie)


if __name__ == "__main__":
    unittest.main()
