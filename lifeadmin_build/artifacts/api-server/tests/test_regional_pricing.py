import os
import unittest
from unittest.mock import MagicMock, patch

import app


class RegionalPricingTests(unittest.TestCase):
    def test_supported_regional_amounts(self):
        self.assertEqual({code: item["amount"] for code, item in app.REGIONAL_PRICES.items()}, {
            "GBP": 199, "USD": 199, "EUR": 199,
            "CAD": 299, "AUD": 399, "INR": 19900,
        })

    def test_checkout_readiness_is_currency_specific(self):
        with patch.dict(os.environ, {
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_PRICE_LIFEADMIN_COMPLETE_EUR": "price_eur",
        }, clear=True), patch.object(app, "get_user_purchases", return_value={"core_app": False, "all_access": False}):
            payload = app.product_payload("guest")
            self.assertTrue(payload["regional_checkout_ready"]["EUR"])
            self.assertFalse(payload["regional_checkout_ready"]["GBP"])
            self.assertFalse(payload["regional_checkout_ready"]["USD"])

    def test_legacy_single_price_is_gbp_only(self):
        with patch.dict(os.environ, {
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_PRICE_LIFEADMIN_COMPLETE": "price_legacy",
        }, clear=True):
            self.assertEqual(app.regional_price_id("GBP"), "price_legacy")
            self.assertIsNone(app.regional_price_id("USD"))

    def test_checkout_rejects_unsupported_or_unconfigured_currency(self):
        handler = MagicMock()
        with patch.dict(os.environ, {
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_PRICE_LIFEADMIN_COMPLETE_GBP": "price_gbp",
        }, clear=True), patch.object(app, "json_response") as response, patch.object(app, "stripe_api_request") as stripe:
            app.create_checkout_session(handler, {"product_id": "core_app", "currency": "JPY"})
            self.assertEqual(response.call_args.args[2], 400)
            app.create_checkout_session(handler, {"product_id": "core_app", "currency": "EUR"})
            self.assertEqual(response.call_args.args[2], 400)
            stripe.assert_not_called()

    def test_checkout_verifies_stripe_price_before_session(self):
        handler = MagicMock()
        with patch.dict(os.environ, {
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_PRICE_LIFEADMIN_COMPLETE_EUR": "price_eur",
        }, clear=True), patch.object(app, "json_response") as response, patch.object(app, "stripe_api_request") as stripe:
            stripe.return_value = {"currency": "usd", "unit_amount": 199, "active": True, "type": "one_time"}
            app.create_checkout_session(handler, {"product_id": "core_app", "currency": "EUR"})
            self.assertEqual(response.call_args.args[2], 400)
            stripe.assert_called_once()
            stripe.reset_mock()
            stripe.return_value = {"currency": "eur", "unit_amount": 299, "active": True, "type": "one_time"}
            app.create_checkout_session(handler, {"product_id": "core_app", "currency": "EUR"})
            self.assertEqual(response.call_args.args[2], 400)
            stripe.assert_called_once()

    def test_checkout_uses_verified_price_and_currency(self):
        handler = MagicMock()
        with patch.dict(os.environ, {
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_PRICE_LIFEADMIN_COMPLETE_CAD": "price_cad",
        }, clear=True), patch.object(app, "json_response") as response, patch.object(app, "effective_user_id", return_value="guest"), patch.object(app, "get_base_url", return_value="https://example.test"), patch.object(app, "stripe_api_request") as stripe:
            stripe.side_effect = [
                {"currency": "cad", "unit_amount": 299, "active": True, "type": "one_time"},
                {"url": "https://checkout.stripe.test", "id": "cs_test"},
            ]
            app.create_checkout_session(handler, {"product_id": "core_app", "currency": "CAD"})
            self.assertEqual(stripe.call_count, 2)
            self.assertEqual(stripe.call_args.args[2]["line_items[0][price]"], "price_cad")
            self.assertEqual(stripe.call_args.args[2]["metadata[currency]"], "CAD")
            self.assertEqual(response.call_args.args[1]["url"], "https://checkout.stripe.test")


if __name__ == "__main__":
    unittest.main()
