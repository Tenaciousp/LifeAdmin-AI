import unittest

import domain


class AccountReferenceTests(unittest.TestCase):
    def test_account_reference_field_is_available_for_common_categories(self):
        for category_id in ("tv_broadband_mobile", "energy_water", "insurance", "subscriptions_memberships"):
            fields = {field["id"]: field for field in domain.fields_for(category_id, "check_bill")}
            self.assertIn("account_reference", fields)
            self.assertFalse(fields["account_reference"]["required"])

    def test_account_reference_survives_task_normalisation(self):
        task = domain.normalise_task({
            "category_id": "tv_broadband_mobile",
            "goal_id": "check_bill",
            "details": {"provider": "Sky", "account_reference": "REF-12345"},
        })
        self.assertEqual(task["details"]["provider"], "Sky")
        self.assertEqual(task["details"]["account_reference"], "REF-12345")


if __name__ == "__main__":
    unittest.main()
