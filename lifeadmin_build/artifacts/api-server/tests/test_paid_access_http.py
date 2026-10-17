"""Synthetic paid-access HTTP checks. No external Stripe requests or real payments."""
import json
import os
import unittest
from unittest.mock import patch

import app
import storage
import test_checkout_http as fixtures


class PaidAccessHTTPTests(unittest.TestCase):
    request = fixtures.CheckoutHTTPTests.request
    event = fixtures.CheckoutHTTPTests.event
    webhook = fixtures.CheckoutHTTPTests.webhook
    register_owner = fixtures.CheckoutHTTPTests.register_owner
    tearDown = fixtures.CheckoutHTTPTests.tearDown

    def setUp(self):
        fixtures.CheckoutHTTPTests.setUp(self)
        rates = patch.dict(app._AUTH_RATE, {}, clear=True)
        rates.start()
        self.addCleanup(rates.stop)
        switch = patch.dict(os.environ, {"PAID_ACCESS_REQUIRED": "true"})
        switch.start()
        self.addCleanup(switch.stop)

    def test_unpurchased_guest_and_account_cannot_use_planning_routes(self):
        for registered in (False, True):
            if registered:
                self.register_owner()
            for route in ("/api/tasks", "/api/notes"):
                status, body = self.request(self.owner_client, route)
                self.assertEqual(status, 402, route)
                self.assertEqual(body["code"], "purchase_required")
            for route in ("/api/suggest", "/api/tasks", "/api/tasks/update",
                          "/api/tasks/delete", "/api/notes/delete", "/api/agent"):
                status, _ = self.request(self.owner_client, route, json.dumps({
                    "user_id": "forged-paid-owner", "query": "Broadband",
                    "task": {"title": "Synthetic bill"}}).encode())
                self.assertEqual(status, 402, route)
            status, body = self.request(self.owner_client, "/api/products")
            self.assertEqual(status, 200)
            self.assertTrue(body["paid_access_required"])
            self.assertFalse(body["planning_access"])

    def test_paid_webhook_enables_only_owner_and_persists_after_relogin(self):
        self.register_owner()
        self.assertEqual(self.webhook(self.event(paid=False))[0], 200)
        self.assertEqual(self.request(self.owner_client, "/api/tasks")[0], 402)
        self.assertEqual(self.webhook(self.event())[0], 200)
        self.assertEqual(self.request(self.owner_client, "/api/products")[1]["planning_access"], True)
        task = {"title": "Synthetic paid bill", "category_id": "tv_broadband_mobile", "goal_id": "check_bill"}
        self.assertEqual(self.request(self.owner_client, "/api/tasks", json.dumps(task).encode())[0], 201)
        self.assertEqual(self.request(self.other_client, "/api/tasks?user_id=" + self.owner_id)[0], 402)
        self.assertEqual(self.request(self.other_client, "/api/tasks", json.dumps({"user_id": self.owner_id, **task}).encode())[0], 402)
        self.assertEqual(self.request(self.owner_client, "/api/auth/logout", b"{}")[0], 200)
        self.assertEqual(self.request(self.owner_client, "/api/tasks")[0], 402)
        login = {"email": "synthetic-purchaser@example.test", "password": "synthetic-password-only"}
        self.assertEqual(self.request(self.owner_client, "/api/auth/login", json.dumps(login).encode())[0], 200)
        self.assertEqual(len(self.request(self.owner_client, "/api/tasks")[1]["tasks"]), 1)

    def test_checkout_requires_account_without_blocking_signin_or_webhook(self):
        payload = json.dumps({"product_id": "core_app", "currency": "GBP"}).encode()
        self.assertEqual(self.request(self.owner_client, "/api/checkout", payload)[0], 401)
        self.register_owner()
        with patch.dict(os.environ, {"STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP": "price_synthetic"}), patch.object(app, "stripe_api_request", side_effect=[
            {"currency": "gbp", "unit_amount": 199, "active": True, "type": "one_time"},
            {"id": "cs_test_paid_gate", "url": "https://checkout.example.test/synthetic"}
        ]):
            self.assertEqual(self.request(self.owner_client, "/api/checkout", payload)[0], 200)
        self.assertEqual(self.request(self.owner_client, "/api/tasks")[0], 402)
        event = self.event()
        with patch.object(app, "stripe_retrieve_session", return_value=event["data"]["object"]):
            self.assertEqual(self.request(self.owner_client, "/api/checkout/status?session_id=cs_test_synthetic_http")[0], 200)
        self.assertEqual(self.request(self.owner_client, "/api/tasks")[0], 200)
        self.assertEqual(self.request(self.owner_client, "/api/checkout", payload)[0], 409)

    def test_access_lookup_failure_is_private_and_does_not_open_tools(self):
        self.register_owner()
        with patch.object(app, "get_user_purchases", side_effect=RuntimeError("synthetic-private-database-detail")):
            for route in ("/api/products", "/api/tasks", "/api/notes"):
                status, body = self.request(self.owner_client, route)
                self.assertEqual(status, 503)
                self.assertNotIn("synthetic-private", json.dumps(body))

    def test_demo_purchase_cannot_bypass_paid_mode(self):
        with patch.dict(os.environ, {"DEMO_PAYMENTS": "true"}):
            for route in ("/api/demo-purchase", "/api/purchases"):
                self.assertEqual(self.request(self.owner_client, route, b'{"product_id":"core_app"}')[0], 403)
        self.assertFalse(self.request(self.owner_client, "/api/products")[1]["planning_access"])

    def test_live_configuration_refuses_unpaid_production_mode(self):
        for key in ("sk_live_synthetic_only", "rk_live_synthetic_only"):
            with patch.dict(os.environ, {"APP_ENV": "production", "SESSION_SECRET": "synthetic", "STRIPE_SECRET_KEY": key, "PAID_ACCESS_REQUIRED": "false"}), patch.object(app, "ensure_data"):
                with self.assertRaisesRegex(RuntimeError, "PAID_ACCESS_REQUIRED=true"):
                    app.main()


if __name__ == "__main__":
    unittest.main()
