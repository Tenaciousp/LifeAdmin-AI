"""Loopback HTTP payment checks; Stripe retrieval is synthetic and no network keys are used."""
from contextlib import nullcontext
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

import app
import storage


class CheckoutHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.webhook_key = "synthetic-webhook-key"
        self.patches = [
            patch.dict(os.environ, {"DATABASE_URL": "", "APP_ENV": "development", "DEMO_PAYMENTS": "false",
                                    "STRIPE_SECRET_KEY": "synthetic-test-only",
                                    "STRIPE_WEBHOOK_SECRET": self.webhook_key,
                                    "STRIPE_WEBHOOK_TOLERANCE": "300"}),
            patch.object(storage, "SQLITE_PATH", Path(self.temp.name) / "accounts.sqlite3"),
            patch.object(app, "TASKS_FILE", os.path.join(self.temp.name, "tasks.json")),
            patch.object(app, "NOTES_FILE", os.path.join(self.temp.name, "notes.json")),
            patch.object(app, "PURCHASES_FILE", os.path.join(self.temp.name, "purchases.json")),
            patch.object(app, "data_lock", side_effect=lambda *a, **kw: nullcontext()),
            patch.object(app, "stripe_api_request", side_effect=AssertionError("Unexpected external Stripe call")),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)
        self.addCleanup(self.temp.cleanup)
        storage.ensure_schema()
        app.write_json(app.PURCHASES_FILE, {"users": {}, "stripe_sessions": {}})
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.AdminPilotHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.owner_jar, self.other_jar = CookieJar(), CookieJar()
        self.owner_client = build_opener(HTTPCookieProcessor(self.owner_jar))
        self.other_client = build_opener(HTTPCookieProcessor(self.other_jar))
        self.request(self.owner_client, "/api/products")
        self.request(self.other_client, "/api/products")
        self.owner_id = next(c.value.split(".", 1)[0] for c in self.owner_jar if c.name == "lifeadmin_guest")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def request(self, client, path, payload=None, signature=None):
        headers = {}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        if signature is not None:
            headers["Stripe-Signature"] = signature
        req = Request(f"http://127.0.0.1:{self.server.server_port}{path}",
                      data=payload, headers=headers)
        try:
            response = client.open(req, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def event(self, paid=True, owner=True):
        metadata = {"product_id": "core_app"}
        if owner:
            metadata["user_id"] = self.owner_id
        return {"type": "checkout.session.completed", "data": {"object": {
            "id": "cs_test_synthetic_http", "payment_status": "paid" if paid else "unpaid",
            "metadata": metadata}}}

    def webhook(self, event, key=None, age=0):
        payload = json.dumps(event).encode()
        timestamp = str(int(time.time()) - age)
        digest = hmac.new((key or self.webhook_key).encode(),
                          timestamp.encode() + b"." + payload, hashlib.sha256).hexdigest()
        return self.request(self.owner_client, "/api/stripe/webhook", payload,
                            f"t={timestamp},v1={digest}")

    def assert_no_access(self, client):
        status, data = self.request(client, "/api/products")
        self.assertEqual(status, 200)
        self.assertFalse(data["purchases"].get("core_app", False))
        self.assertFalse(data["purchases"].get("all_access", False))

    def test_bad_missing_and_expired_signatures_do_not_grant_access(self):
        for key, age in (("incorrect-synthetic-key", 0), (self.webhook_key, 600)):
            with self.subTest(age=age):
                self.assertEqual(self.webhook(self.event(), key=key, age=age)[0], 400)
        self.assertEqual(self.request(self.owner_client, "/api/stripe/webhook",
                                     json.dumps(self.event()).encode())[0], 400)
        self.assert_no_access(self.owner_client)
        self.assertEqual(app.load_purchase_store()["stripe_sessions"], {})

    def test_unpaid_and_wrong_owner_return_do_not_grant_access(self):
        unpaid = self.event(paid=False)
        self.assertEqual(self.webhook(unpaid)[0], 200)
        with patch.object(app, "stripe_retrieve_session", return_value=unpaid["data"]["object"]):
            status, data = self.request(self.owner_client, "/api/checkout/status?session_id=cs_test_synthetic_http")
            self.assertEqual(status, 200)
            self.assertFalse(data["paid"])
        with patch.object(app, "stripe_retrieve_session", return_value=self.event()["data"]["object"]):
            self.assertEqual(self.request(self.other_client,
                             "/api/checkout/status?session_id=cs_test_synthetic_http")[0], 403)
        self.assert_no_access(self.owner_client)
        self.assert_no_access(self.other_client)

    def test_unbound_and_conflicting_owner_payment_never_grants_access(self):
        for conflict in (False, True):
            event = self.event(owner=conflict)
            if conflict:
                event["data"]["object"]["client_reference_id"] = "another_synthetic_owner"
            with self.subTest(conflict=conflict):
                self.assertEqual(self.webhook(event)[0], 200)
                with patch.object(app, "stripe_retrieve_session", return_value=event["data"]["object"]):
                    self.assertEqual(self.request(self.owner_client,
                                     "/api/checkout/status?session_id=cs_test_synthetic_http")[0], 403)
        self.assert_no_access(self.owner_client)
        self.assertEqual(app.load_purchase_store()["users"], {})
        self.assertEqual(app.load_purchase_store()["stripe_sessions"], {})

    def test_paid_webhook_replay_and_return_keep_one_owner_and_one_session(self):
        event = self.event()
        self.assertEqual(self.webhook(event)[0], 200)
        self.assertEqual(self.webhook(event)[0], 200)
        with patch.object(app, "stripe_retrieve_session", return_value=event["data"]["object"]):
            for _ in range(2):
                status, data = self.request(self.owner_client,
                                           "/api/checkout/status?session_id=cs_test_synthetic_http")
                self.assertEqual(status, 200)
                self.assertTrue(data["paid"])
                self.assertTrue(data["purchases"]["core_app"])
                self.assertTrue(data["purchases"]["all_access"])
        store = app.load_purchase_store()
        self.assertEqual(set(store["users"]), {self.owner_id})
        self.assertEqual(set(store["stripe_sessions"]), {"cs_test_synthetic_http"})
        self.assertEqual(store["stripe_sessions"]["cs_test_synthetic_http"]["user_id"], self.owner_id)
        self.assert_no_access(self.other_client)

    def register_owner(self):
        status, data = self.request(self.owner_client, "/api/auth/register",
                                   json.dumps({"email": "synthetic-purchaser@example.test",
                                               "password": "synthetic-password-only"}).encode())
        self.assertEqual(status, 201)
        self.owner_id = data["user"]["id"]

    def test_checkout_provider_failure_is_private_and_retryable(self):
        payload = json.dumps({"product_id": "core_app", "currency": "GBP"}).encode()
        price = {"currency": "gbp", "unit_amount": 199, "active": True, "type": "one_time"}
        private_detail = "synthetic-private-provider-detail"
        with patch.dict(os.environ, {"STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP": "price_synthetic"}):
            for responses in ([RuntimeError(private_detail)], [price, RuntimeError(private_detail)]):
                with self.subTest(stage=len(responses)), patch.object(app, "stripe_api_request", side_effect=responses):
                    status, data = self.request(self.owner_client, "/api/checkout", payload)
                    self.assertEqual(status, 503)
                    self.assertNotIn(private_detail, json.dumps(data))
                    self.assertIn("try again", data["error"].lower())
                    self.assert_no_access(self.owner_client)
            with patch.object(app, "stripe_api_request", side_effect=[price, {
                "url": "https://checkout.example.test/synthetic", "id": "cs_test_retry"
            }]):
                status, data = self.request(self.owner_client, "/api/checkout", payload)
                self.assertEqual(status, 200)
                self.assertEqual(data["id"], "cs_test_retry")
            self.assert_no_access(self.owner_client)

    def test_payment_verification_failure_preserves_safe_retry(self):
        private_detail = "synthetic-private-verification-detail"
        path = "/api/checkout/status?session_id=cs_test_synthetic_http"
        with patch.object(app, "stripe_retrieve_session", side_effect=RuntimeError(private_detail)):
            status, data = self.request(self.owner_client, path)
            self.assertEqual(status, 503)
            self.assertNotIn(private_detail, json.dumps(data))
            self.assertIn("retry", data["error"].lower())
            self.assertIn("do not pay again", data["error"].lower())
        self.assert_no_access(self.owner_client)
        with patch.object(app, "stripe_retrieve_session", return_value=self.event()["data"]["object"]):
            status, data = self.request(self.owner_client, path)
            self.assertEqual(status, 200)
            self.assertTrue(data["paid"])
        self.assert_no_access(self.other_client)

    def test_invalid_checkout_session_is_a_validation_error(self):
        status, data = self.request(self.owner_client, "/api/checkout/status?session_id=invalid")
        self.assertEqual(status, 400)
        self.assertIn("Invalid", data["error"])
        self.assert_no_access(self.owner_client)

    def test_registered_async_purchase_replay_keeps_one_database_entitlement(self):
        self.register_owner()
        event = self.event()
        event["type"] = "checkout.session.async_payment_succeeded"
        self.assertEqual(self.webhook(event)[0], 200)
        self.assertEqual(self.webhook(event)[0], 200)
        with patch.object(app, "stripe_retrieve_session", return_value=event["data"]["object"]):
            status, data = self.request(self.owner_client,
                                       "/api/checkout/status?session_id=cs_test_synthetic_http")
            self.assertEqual(status, 200)
            self.assertTrue(data["paid"])
        with storage.sqlite_connect() as connection:
            count = connection.execute("SELECT COUNT(*) FROM adminpilot_purchases WHERE user_id = ?",
                                       (self.owner_id,)).fetchone()[0]
        self.assertEqual(count, 1)
        self.assertEqual(app.load_purchase_store()["stripe_sessions"], {})
        self.assert_no_access(self.other_client)

    def test_paid_guest_entitlement_follows_account_registration(self):
        guest_id = self.owner_id
        self.assertEqual(self.webhook(self.event())[0], 200)
        self.register_owner()
        status, data = self.request(self.owner_client, "/api/products")
        self.assertEqual(status, 200)
        self.assertTrue(data["purchases"]["core_app"])
        self.assertTrue(data["purchases"]["all_access"])
        self.assertNotIn(guest_id, app.load_purchase_store()["users"])
        self.assertTrue(storage.get_purchases(self.owner_id)["core_app"])
        self.assert_no_access(self.other_client)


if __name__ == "__main__":
    unittest.main()

