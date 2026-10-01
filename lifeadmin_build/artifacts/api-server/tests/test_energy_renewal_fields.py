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


    def test_renewal_preferences_survive_normalisation_and_shape_plan(self):
        task = domain.normalise_task({
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {
                "provider": "Example Energy",
                "renewal_priority": "Lowest total cost",
                "switch_willingness": "Prefer to stay if the price is competitive",
            },
        })

        sections = renewal_sections(task)

        self.assertIn("Lowest total cost", sections["next_steps"])
        self.assertIn(
            "Prefer to stay if the price is competitive",
            sections["next_steps"],
        )
        self.assertIn(
            "Renewal priority: Lowest total cost.",
            sections["things_to_check"],
        )
        self.assertIn(
            "Switching preference: Prefer to stay if the price is competitive.",
            sections["things_to_check"],
        )
        self.assertIn(
            "stated renewal priority and switching preference",
            sections["approval_checklist"],
        )
        self.assertIn(
            "My main priority is Lowest total cost.",
            sections["provider_message"],
        )
        self.assertIn(
            "My switching preference is Prefer to stay if the price is competitive.",
            sections["provider_message"],
        )

    def test_renewal_provider_message_omits_unsupplied_preferences(self):
        sections = renewal_sections({
            "details": {
                "provider": "Example Energy",
            }
        })

        self.assertNotIn("not supplied", sections["provider_message"])
        self.assertNotIn("My main priority is", sections["provider_message"])
        self.assertNotIn("My switching preference is", sections["provider_message"])


if __name__ == "__main__":
    unittest.main()
