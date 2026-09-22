import os
import unittest
from http.cookies import SimpleCookie
from unittest.mock import Mock, patch

import app
import domain


class CatalogTests(unittest.TestCase):
    def test_catalog_has_12_categories_and_7_goals(self):
        payload = domain.catalog()
        self.assertEqual(
            {item["id"] for item in payload["categories"]},
            {"tv_broadband_mobile", "energy_water", "insurance", "council_tax_licences", "subscriptions_memberships", "rent_mortgage_property", "credit_loans_finance", "transport_vehicle", "health_care_pets", "family_childcare_education", "home_security_maintenance", "other_regular_payment"},
        )
        self.assertEqual(
            {item["id"] for item in payload["goals"]},
            {"identify_payment", "check_bill", "prepare_renewal", "reduce_price", "cancel_switch", "challenge_charge", "contact_provider"},
        )
        for category in payload["categories"]:
            self.assertTrue(all({"id", "label", "type", "required"}.issubset(field) for field in category["fields"]))
            self.assertTrue(category["examples"])

    def test_suggestion_routes_provider_and_goal(self):
        result = domain.suggest("Netflix cancel subscription")
        self.assertEqual(result["category_id"], "subscriptions_memberships")
        self.assertEqual(result["category"], "subscriptions_memberships")
        self.assertEqual(result["goal"], "cancel_switch")
        self.assertGreater(result["confidence"], 0)
        unknown = domain.suggest("unknown Netflix card payment")
        self.assertEqual(unknown["goal_id"], "identify_payment")

    def test_suggestion_routes_all_approved_examples(self):
        examples = [
            ("Sky broadband price", "tv_broadband_mobile", "reduce_price"),
            ("energy tariff renewal", "energy_water", "prepare_renewal"),
            ("car insurance renewal", "insurance", "prepare_renewal"),
            ("council tax bill", "council_tax_licences", "check_bill"),
            ("Netflix cancel", "subscriptions_memberships", "cancel_switch"),
            ("mortgage renewal", "rent_mortgage_property", "prepare_renewal"),
            ("credit card wrong charge", "credit_loans_finance", "challenge_charge"),
            ("vehicle insurance renewal", "insurance", "prepare_renewal"),
            ("vet payment", "health_care_pets", "check_bill"),
            ("nursery fees", "family_childcare_education", "check_bill"),
            ("boiler cover renewal", "home_security_maintenance", "prepare_renewal"),
            ("unknown recurring payment", "other_regular_payment", "identify_payment"),
        ]
        for query, category_id, goal_id in examples:
            with self.subTest(query=query):
                result = domain.suggest(query)
                self.assertEqual(result["category_id"], category_id)
                self.assertEqual(result["goal_id"], goal_id)


class ResultContractTests(unittest.TestCase):
    def test_nine_approved_household_scenarios_have_structured_results(self):
        cases = [
            ("Broadband price", "tv_broadband_mobile", "reduce_price"),
            ("Netflix cancellation", "subscriptions_memberships", "cancel_switch"),
            ("Mobile bill challenge", "tv_broadband_mobile", "challenge_charge"),
            ("Energy renewal", "energy_water", "prepare_renewal"),
            ("Car insurance renewal", "insurance", "prepare_renewal"),
            ("Council tax discount", "council_tax_licences", "check_bill"),
            ("Credit card payment", "credit_loans_finance", "challenge_charge"),
            ("Gym membership", "subscriptions_memberships", "cancel_switch"),
            ("Unknown recurring payment", "other_regular_payment", "identify_payment"),
        ]
        for title, category, goal in cases:
            task = {"title": title, "category_id": category, "goal_id": goal, "details": {"provider": "Example"}}
            result = app.result_contract(app.fallback_agent(task), task)
            with self.subTest(title=title):
                self.assertIn("next_steps", result)
                self.assertIn("approval_checklist", result)
                self.assertIn("known_details", result)
                self.assertIn("missing_details", result)

    def test_unknown_payment_has_bank_query_and_no_provider_message(self):
        task = {
            "title": "Unknown recurring payment",
            "category_id": "other_regular_payment",
            "goal_id": "identify_payment",
            "details": {"statement_description": "XYZ 12.99", "amount": "£12.99"},
        }
        result = app.result_contract(app.fallback_agent(task), task)
        self.assertEqual(result["provider_message"], "")
        self.assertIn("bank or card provider", result["next_steps"])
        self.assertIn("Apple", result["things_to_check"])
        self.assertEqual(result["provider_email"]["subject"], "Query about an unrecognised payment")
        self.assertIn("known_details", result)

    def test_regular_provider_email_requires_provider_message(self):
        task = {"title": "Review broadband", "category_id": "tv_broadband_mobile", "details": {"provider": "Sky"}}
        result = app.result_contract("## Provider message\nHello, please review my bill.", task)
        self.assertEqual(result["provider_email"]["subject"], "Bill query - Sky")
        self.assertIn("please review", result["provider_email"]["body"])
        empty = app.result_contract("## Next steps\nCheck your bill.", task)
        self.assertIsNone(empty["provider_email"])

    def test_energy_plan_has_practical_things_to_check(self):
        task = {
            "title": "Energy tariff ending",
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {"provider": "British Gas"},
        }
        result = app.result_contract(app.fallback_agent(task), task)
        self.assertIn("unit rates", result["things_to_check"].lower())
        self.assertIn("standing charges", result["things_to_check"].lower())
        self.assertIn("exit fees", result["things_to_check"].lower())

    def test_live_ai_output_requires_exact_four_section_contract(self):
        valid = """## Next steps
Do this.

## Provider message
Hello.

## Things to check
Check this.

## Approval checklist
Review this."""
        self.assertTrue(app.valid_ai_result_contract(valid))
        self.assertFalse(app.valid_ai_result_contract("## Next steps\nOnly one section"))
        self.assertFalse(app.valid_ai_result_contract(valid.replace("Things to check", "Other notes")))


class TaskUpdateValidationTests(unittest.TestCase):
    def test_task_updates_are_bounded_and_canonical(self):
        changes = app.sanitize_task_changes({
            "title": "x" * 500,
            "category_id": "not-real",
            "goal_id": "not-real",
            "details": {"provider": "p" * 700},
            "priority": "Critical",
            "status": "Anything",
            "notes": "n" * 5000,
        })
        self.assertEqual(len(changes["title"]), 160)
        self.assertEqual(changes["category_id"], "other_regular_payment")
        self.assertEqual(changes["goal_id"], "check_bill")
        self.assertEqual(len(changes["details"]["provider"]), 500)
        self.assertEqual(changes["priority"], "Medium")
        self.assertEqual(changes["status"], "Open")
        self.assertEqual(len(changes["notes"]), 4000)


class SecurityDefaultsTests(unittest.TestCase):
    def test_demo_payments_are_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(app.env_bool("DEMO_PAYMENTS", False))

    def test_guest_cookie_is_signed_and_not_caller_supplied(self):
        handler = Mock()
        handler.headers = {"Cookie": ""}
        handler._guest_cookie = None
        first = app.guest_session(handler)
        cookie = SimpleCookie()
        cookie.load(handler._guest_cookie)
        self.assertIn("lifeadmin_guest", cookie)
        self.assertNotEqual(first, "attacker")
        self.assertIn(".", cookie["lifeadmin_guest"].value)

    def test_admin_allowlist(self):
        user = {"email": "owner@example.com"}
        with patch.dict(os.environ, {"ADMIN_EMAILS": "owner@example.com"}):
            self.assertTrue(app.is_admin(user))
        with patch.dict(os.environ, {"ADMIN_EMAILS": "other@example.com"}):
            self.assertFalse(app.is_admin(user))


if __name__ == "__main__":
    unittest.main()