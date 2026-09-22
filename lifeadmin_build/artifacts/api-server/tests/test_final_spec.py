import os
import pathlib
import unittest
from unittest.mock import patch

import app
import domain


class DynamicFormTests(unittest.TestCase):
    def test_communications_fields_include_contract_details(self):
        ids = {field["id"] for field in domain.fields_for("tv_broadband_mobile", "reduce_price")}
        self.assertIn("contract_end_date", ids)
        self.assertIn("package", ids)
        self.assertIn("must_keep", ids)

    def test_goal_fields_are_dynamic_and_recommended(self):
        renewal = {field["id"]: field for field in domain.fields_for("insurance", "prepare_renewal")}
        self.assertTrue(renewal["date"].get("recommended"))
        self.assertIn("new_quote", renewal)
        cancellation = {field["id"] for field in domain.fields_for("subscriptions_memberships", "cancel_switch")}
        self.assertIn("billing_route", cancellation)
        self.assertIn("next_payment_date", cancellation)

    def test_missing_details_uses_recommended_fields_without_duplicates(self):
        missing = domain.missing_details({
            "category_id": "other_regular_payment",
            "goal_id": "identify_payment",
            "details": {},
        })
        self.assertEqual(len(missing), len(set(missing)))
        self.assertIn("Statement description", missing)
        self.assertIn("Amount", missing)

    def test_task_normalisation_uses_canonical_fallback(self):
        task = domain.normalise_task({"category_id": "not-real", "goal_id": "not-real", "details": {}})
        self.assertEqual(task["category_id"], "other_regular_payment")
        self.assertEqual(task["goal_id"], "check_bill")

    def test_short_provider_names_do_not_match_inside_words(self):
        result = domain.suggest("nursery fees")
        self.assertEqual(result["category_id"], "family_childcare_education")
        self.assertNotEqual(result["category_id"], "tv_broadband_mobile")


class PaymentSafetyTests(unittest.TestCase):
    def test_stripe_readiness_requires_secret_and_price(self):
        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_test", "STRIPE_PRICE_CORE_APP": "price_core"}, clear=True):
            self.assertTrue(app.stripe_ready_for(app.CORE_PRODUCT))
            self.assertFalse(app.stripe_ready_for(app.ALL_ACCESS_PRODUCT))

    def test_public_products_do_not_expose_internal_environment_names(self):
        payload = app.public_product(app.CORE_PRODUCT)
        self.assertNotIn("price_env", payload)
        self.assertNotIn("amount_pence", payload)
        self.assertIn("checkout_ready", payload)

    def test_product_payload_is_preview_until_both_prices_are_ready(self):
        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_test", "STRIPE_PRICE_CORE_APP": "price_core"}, clear=True), \
             patch.object(app, "get_user_purchases", return_value={"core_app": False, "all_access": False}):
            payload = app.product_payload("guest")
            self.assertFalse(payload["payments_live"])
            self.assertEqual(payload["payment_provider"], "preview")
            self.assertNotIn("missing_price_env_vars", payload)


class FrontendFinalSpecTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai"
        cls.source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (root / "src").rglob("*")
            if path.suffix in {".ts", ".tsx"}
        )

    def test_final_picker_and_journey_copy_is_present(self):
        for phrase in ("Popular choices", "Browse all categories", "Useful if you know it", "Continue with an AI assistant"):
            self.assertIn(phrase, self.source)

    def test_account_deletion_requires_explicit_delete_confirmation(self):
        self.assertIn('deleteConfirm !== "DELETE"', self.source)
        self.assertIn("Type DELETE to confirm", self.source)

    def test_landing_page_contains_conversion_and_trust_sections(self):
        self.assertIn("Start with a bill", self.source)
        self.assertIn("You stay in control", self.source)
        self.assertIn("Simple one-time pricing", self.source)
        self.assertIn("FAQ", self.source)

    def test_analytics_bridge_supports_privacy_safe_google_tag_readiness(self):
        self.assertIn("dataLayer", self.source)
        self.assertIn("provider|description|notes|message|account|address", self.source)
        self.assertIn("provider", self.source)
        self.assertIn("description", self.source)


class OutputQualityRegressionTests(unittest.TestCase):
    def test_netflix_details_provider_gets_netflix_first_cancellation_output(self):
        task = {
            "title": "Cancel Netflix",
            "category_id": "subscriptions_memberships",
            "goal_id": "cancel_switch",
            "details": {"provider": "Netflix", "amount": "£10.99"},
        }
        result = app.result_contract(app.fallback_agent(task), task)
        self.assertIn("Netflix", result["next_steps"])
        self.assertIn("Netflix", result["provider_message"])
        self.assertIsNotNone(result["provider_email"])
        self.assertIn("Cancellation", result["provider_email"]["subject"])

    def test_credit_card_challenge_is_dispute_specific(self):
        task = {
            "title": "Wrong card charge",
            "category_id": "credit_loans_finance",
            "goal_id": "challenge_charge",
            "details": {"provider": "Barclaycard", "amount": "£45"},
        }
        result = app.result_contract(app.fallback_agent(task), task)
        combined = result["next_steps"] + result["things_to_check"] + result["provider_message"]
        self.assertIn("dispute", combined.lower())
        self.assertIn("full card", combined.lower())

    def test_fraud_language_adds_safety_escalation(self):
        task = {
            "title": "Unauthorised card charge",
            "category_id": "credit_loans_finance",
            "goal_id": "challenge_charge",
            "details": {"provider": "Card provider", "what_happened": "I think this is fraud and unauthorised"},
        }
        result = app.result_contract(app.fallback_agent(task), task)
        self.assertIn("official fraud channel", result["things_to_check"].lower())
        self.assertIn("one-time codes", result["things_to_check"].lower())

    def test_analytics_requires_explicit_consent_and_checkout_return_is_verified(self):
        root = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src"
        analytics = (root / "lib" / "analytics.ts").read_text(encoding="utf-8")
        checkout = (root / "components" / "CheckoutReturnHandler.tsx").read_text(encoding="utf-8")
        self.assertIn('lifeadmin_analytics_consent', analytics)
        self.assertIn('granted', analytics)
        self.assertIn('/api/checkout/status', checkout)
        self.assertIn('purchase_verified', checkout)

    def test_saved_plans_can_be_reopened(self):
        root = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
        source = root.read_text(encoding="utf-8")
        self.assertIn("Recent plans", source)
        self.assertIn("handleOpenSavedPlan", source)

    def test_result_renderer_formats_headings_lists_and_checklists(self):
        root = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
        source = root.read_text(encoding="utf-8")
        self.assertIn("heading = line.match", source)
        self.assertIn("list-disc", source)
        self.assertIn("list-decimal", source)
        self.assertIn("checklist = line.match", source)
        self.assertIn("dangerouslySetInnerHTML", source)

    def test_provider_copy_uses_clean_email_body_and_unknown_payment_bank_query(self):
        root = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
        source = root.read_text(encoding="utf-8")
        self.assertIn('activeTab === "provider_message" && providerEmail?.body ? providerEmail.body', source)
        self.assertIn("Copy bank query message", source)


if __name__ == "__main__":
    unittest.main()
