import unittest

import domain
from energy_renewal import renewal_sections


class EnergyRenewalFieldTests(unittest.TestCase):
    def test_dual_fuel_rate_fields_keep_compatible_ids_and_clear_examples(self):
        fields = {
            field["id"]: field
            for field in domain.fields_for("energy_water", "prepare_renewal")
        }

        self.assertEqual(fields["unit_rate"]["label"], "Unit rate(s)")
        self.assertIn("electricity 24.5p/kWh", fields["unit_rate"]["placeholder"])
        self.assertIn("gas 6.2p/kWh", fields["unit_rate"]["placeholder"])

        self.assertEqual(fields["standing_charge"]["label"], "Standing charge(s)")
        self.assertIn("electricity 52p/day", fields["standing_charge"]["placeholder"])
        self.assertIn("gas 31p/day", fields["standing_charge"]["placeholder"])

        self.assertEqual(fields["annual_usage"]["id"], "annual_usage")
        self.assertEqual(fields["unit_rate"]["id"], "unit_rate")
        self.assertEqual(fields["standing_charge"]["id"], "standing_charge")


    def test_renewal_plan_keeps_current_tariff_context(self):
        sections = renewal_sections({
            "details": {
                "provider": "Example Energy",
                "tariff": "Fixed",
            }
        })

        self.assertIn("Current tariff: Fixed.", sections["things_to_check"])
        self.assertIn("current tariff name and type", sections["provider_message"])


if __name__ == "__main__":
    unittest.main()
