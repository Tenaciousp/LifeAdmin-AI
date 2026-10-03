import unittest

import app


class CategorySpecificPlaybookTests(unittest.TestCase):
    def _plan(self, category_id, provider, details=None):
        task = {
            "title": f"Review {provider}",
            "category_id": category_id,
            "goal_id": "reduce_price",
            "details": {"provider": provider, **(details or {})},
        }
        text = app.fallback_agent(task)
        return text, app.result_contract(text, task)

    def test_transport_uses_dedicated_cost_and_eligibility_route(self):
        text, result = self._plan(
            "transport_vehicle",
            "Transport provider",
            {"vehicle_or_booking": "Rail pass", "reference": "REF-123"},
        )
        self.assertEqual(app.detect_playbook({
            "category_id": "transport_vehicle",
            "goal_id": "reduce_price",
            "details": {},
        }), "transport")
        self.assertIn("total annual or journey cost", text)
        self.assertIn("official charges", text)
        self.assertIn("Transport provider", result["provider_message"])

    def test_health_care_pet_route_protects_continuity_and_urgent_help(self):
        text, result = self._plan(
            "health_care_pets",
            "Care provider",
            {"service_type": "Dental plan"},
        )
        self.assertIn("continuity of care", text)
        self.assertIn("Do not delay urgent", result["things_to_check"])
        self.assertIn("No treatment, cover or payment change", result["approval_checklist"])

    def test_family_route_separates_funded_hours_and_paid_extras(self):
        text, result = self._plan(
            "family_childcare_education",
            "Nursery provider",
            {"family_service": "Nursery", "deadline": "2026-11-01"},
        )
        self.assertIn("funded and paid hours", text)
        self.assertIn("total term or annual cost", text)
        self.assertIn("Nursery provider", result["provider_message"])
        self.assertIn("Funding assumptions", result["approval_checklist"])

    def test_home_service_route_compares_full_cover_terms(self):
        text, result = self._plan(
            "home_security_maintenance",
            "Home service provider",
            {"home_service": "Boiler cover", "contract_end_date": "2026-12-01"},
        )
        self.assertEqual(app.detect_playbook({
            "category_id": "home_security_maintenance",
            "goal_id": "prepare_renewal",
            "details": {},
        }), "home_services")
        for phrase in ("call-out fees", "parts and labour limits", "response targets", "total annual cost"):
            self.assertIn(phrase, text)
        self.assertIn("Home service provider", result["provider_message"])
        self.assertIn("written terms", result["approval_checklist"])

    def test_each_new_route_produces_all_customer_facing_sections(self):
        cases = (
            ("transport_vehicle", "Transport provider"),
            ("health_care_pets", "Care provider"),
            ("family_childcare_education", "Education provider"),
            ("home_security_maintenance", "Home provider"),
        )
        for category_id, provider in cases:
            with self.subTest(category_id=category_id):
                _, result = self._plan(category_id, provider)
                for section in ("next_steps", "provider_message", "things_to_check", "approval_checklist"):
                    self.assertTrue(result[section].strip(), section)


if __name__ == "__main__":
    unittest.main()
