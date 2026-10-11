import json
import unittest
from unittest.mock import patch
import app


class CheckoutOwnershipTests(unittest.TestCase):
    def status(self, session, browser_owner="synthetic_browser"):
        with patch.object(app, "stripe_configured", return_value=True), \
             patch.object(app, "stripe_retrieve_session", return_value=session), \
             patch.object(app, "current_user", return_value=None), \
             patch.object(app, "guest_session", return_value=browser_owner), \
             patch.object(app, "effective_user_id", return_value=browser_owner), \
             patch.object(app, "unlock_purchase", return_value={"core_app": True}) as grant, \
             patch.object(app, "json_response", side_effect=lambda handler, body, status=200: (status, body)):
            result = app.checkout_status(object(), {"session_id": ["cs_test_synthetic"]})
            return result, grant.call_args_list

    def test_missing_owner_never_grants_requesting_browser(self):
        for owner in (None, ""):
            metadata = {"product_id": "core_app"}
            if owner is not None:
                metadata["user_id"] = owner
            with self.subTest(owner=owner):
                result, grants = self.status({"payment_status": "paid", "metadata": metadata})
                self.assertEqual(result[0], 403)
                self.assertEqual(grants, [])

    def test_conflicting_owner_references_do_not_grant_access(self):
        result, grants = self.status({"payment_status": "paid",
            "metadata": {"product_id": "core_app", "user_id": "synthetic_browser"},
            "client_reference_id": "different_synthetic_owner"})
        self.assertEqual(result[0], 403)
        self.assertEqual(grants, [])

    def test_paid_session_requires_matching_trusted_owner(self):
        for metadata, reference in (
            ({"product_id": "core_app", "user_id": "synthetic_browser"}, "synthetic_browser"),
            ({"product_id": "core_app"}, "synthetic_browser"),
        ):
            with self.subTest(metadata=metadata):
                result, grants = self.status({"payment_status": "paid",
                    "metadata": metadata, "client_reference_id": reference})
                self.assertEqual(result[0], 200)
                self.assertTrue(result[1]["paid"])
                self.assertEqual(grants[0].args[0], "synthetic_browser")

    def test_unpaid_or_other_owner_never_grants_access(self):
        for payment_status, owner in (("unpaid", "synthetic_browser"), ("paid", "another_owner")):
            with self.subTest(payment_status=payment_status, owner=owner):
                result, grants = self.status({"payment_status": payment_status,
                    "metadata": {"product_id": "core_app", "user_id": owner}})
                self.assertEqual(grants, [])
                self.assertEqual(result[0], 200 if payment_status == "unpaid" else 403)

    def test_webhook_never_assigns_unbound_or_conflicting_payment_to_demo(self):
        for owner, reference in ((None, None), ("", ""), ("synthetic_owner", "different_owner")):
            event = {"type": "checkout.session.completed", "data": {"object": {
                "id": "cs_test_synthetic", "payment_status": "paid",
                "metadata": {"product_id": "core_app", "user_id": owner},
                "client_reference_id": reference}}}
            handler = type("Handler", (), {"headers": {}})()
            with self.subTest(owner=owner, reference=reference), \
                 patch.object(app, "read_raw_body", return_value=json.dumps(event).encode()), \
                 patch.object(app, "verify_stripe_webhook"), \
                 patch.object(app, "unlock_purchase") as grant, \
                 patch.object(app, "json_response"):
                app.handle_stripe_webhook(handler)
                grant.assert_not_called()

    def test_bound_paid_webhook_preserves_legacy_reference_and_repeat_behavior(self):
        event = {"type": "checkout.session.async_payment_succeeded", "data": {"object": {
            "id": "cs_test_synthetic", "payment_status": "paid",
            "metadata": {"product_id": "core_app"}, "client_reference_id": "synthetic_owner"}}}
        handler = type("Handler", (), {"headers": {}})()
        with patch.object(app, "read_raw_body", return_value=json.dumps(event).encode()), \
             patch.object(app, "verify_stripe_webhook"), \
             patch.object(app, "unlock_purchase") as grant, \
             patch.object(app, "json_response"):
            app.handle_stripe_webhook(handler)
            app.handle_stripe_webhook(handler)
            self.assertEqual(grant.call_count, 2)
            self.assertTrue(all(call.args == ("synthetic_owner", "core_app", "stripe_webhook", "cs_test_synthetic")
                                for call in grant.call_args_list))


if __name__ == "__main__":
    unittest.main()
