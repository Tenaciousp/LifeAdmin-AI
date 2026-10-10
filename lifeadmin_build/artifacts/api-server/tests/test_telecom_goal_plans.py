import unittest
import app


class TelecomGoalPlanTests(unittest.TestCase):
    def plan(self, goal):
        task = {"title": "QA mobile bill", "category_id": "tv_broadband_mobile", "goal_id": goal,
                "details": {"provider": "QA Mobile", "account_reference": "QA-001",
                            "amount": "35", "previous_amount": "25", "what_happened": "Unexpected extra charge"}}
        return app.result_contract(app.fallback_agent(task), task)

    def test_bill_check_explains_charges_instead_of_negotiating(self):
        result = self.plan("check_bill")
        self.assertIn("Compare the latest bill", result["next_steps"])
        self.assertIn("itemised charges", result["provider_email"]["body"])
        self.assertIn("QA-001", result["provider_email"]["body"])
        self.assertIn("Unexpected extra charge", result["provider_email"]["body"])
        self.assertNotIn("retention price", result["provider_message"])
        self.assertNotIn("Competition comparison", result["next_steps"])

    def test_dispute_cancellation_and_contact_have_distinct_actions(self):
        expectations = {"challenge_charge": "disputed charge", "cancel_switch": "service continuity",
                        "contact_provider": "specific question"}
        for goal, expected in expectations.items():
            with self.subTest(goal=goal):
                result = self.plan(goal)
                self.assertIn(expected, result["next_steps"])
                self.assertNotIn("Competition comparison", result["next_steps"])
                self.assertIn("QA Mobile", result["provider_email"]["body"])
                self.assertTrue(result["things_to_check"])
                self.assertTrue(result["approval_checklist"])
        self.assertIn("not authorisation to cancel", self.plan("cancel_switch")["provider_email"]["body"])

    def test_savings_and_renewal_keep_comparison_flow(self):
        for goal in ("reduce_price", "prepare_renewal"):
            with self.subTest(goal=goal):
                self.assertIn("Competition comparison", self.plan(goal)["next_steps"])
