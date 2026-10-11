import unittest
import app


class SubscriptionContextTests(unittest.TestCase):
    def plan(self, goal, details):
        task = {"title": "QA subscription", "category_id": "subscriptions_memberships",
                "goal_id": goal, "details": details}
        return app.result_contract(app.fallback_agent(task), task)

    def test_cancellation_keeps_reference_reason_and_billing_details(self):
        details = {"provider": "QA Streaming Service", "account_reference": "QA-CANCEL-004",
                   "payment_description": "Fictional monthly video subscription", "amount": "12",
                   "what_happened": "No longer using this fictional service",
                   "billing_route": "Direct with provider", "next_payment_date": "2026-11-01",
                   "minimum_term_end": "2026-10-31", "confirmation_received": "Not yet requested"}
        result = self.plan("cancel_switch", details)
        for value in details.values():
            with self.subTest(value=value):
                self.assertIn(value, result["next_steps"])
                self.assertIn(value, result["provider_email"]["body"])
        self.assertIn("cancellation", result["provider_email"]["body"])
        self.assertIn("No cancellation or dispute submitted without human approval", result["approval_checklist"])

    def test_dispute_keeps_supplied_charge_and_issue(self):
        result = self.plan("challenge_charge", {"provider": "QA Subscription", "amount": "18",
                           "date": "2026-10-01", "account_reference": "QA-DISPUTE-005",
                           "what_happened": "Fictional duplicate charge after cancellation"})
        body = result["provider_email"]["body"]
        for value in ("18", "2026-10-01", "QA-DISPUTE-005", "Fictional duplicate charge after cancellation"):
            self.assertIn(value, body)
        self.assertIn("correction or refund", body)

    def test_missing_optional_details_are_not_invented(self):
        result = self.plan("check_bill", {"provider": "QA Subscription"})
        body = result["provider_email"]["body"]
        self.assertNotIn("Account or customer reference:", body)
        self.assertNotIn("Current payment:", body)
        self.assertNotIn("None", body)
        self.assertIn("Confirm the current price", result["next_steps"])
