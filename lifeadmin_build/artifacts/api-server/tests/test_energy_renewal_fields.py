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

    def test_renewal_specific_price_and_date_take_precedence(self):
        sections = renewal_sections({
            "details": {
                "provider": "Example Energy",
                "amount": "GBP 95 per month",
                "current_price": "GBP 120 per month",
                "date": "01 January 2027",
                "renewal_date": "15 January 2027",
                "new_quote": "GBP 132 per month",
            }
        })

        self.assertIn("My current price is GBP 120 per month.", sections["provider_message"])
        self.assertNotIn("GBP 95 per month", sections["provider_message"])
        self.assertIn("My renewal date is 15 January 2027.", sections["provider_message"])
        self.assertNotIn("My renewal date is 01 January 2027.", sections["provider_message"])
        self.assertIn("Renewal date: 15 January 2027.", sections["things_to_check"])
        self.assertNotIn("Renewal date: 01 January 2027.", sections["things_to_check"])

    def test_legacy_amount_and_date_still_feed_renewal_plan(self):
        sections = renewal_sections({
            "details": {
                "provider": "Example Energy",
                "amount": "GBP 95 per month",
                "date": "01 January 2027",
            }
        })

        self.assertIn("My current price is GBP 95 per month.", sections["provider_message"])
        self.assertIn("My renewal date is 01 January 2027.", sections["provider_message"])
        self.assertIn("Renewal date: 01 January 2027.", sections["things_to_check"])

    def test_renewal_provider_message_omits_unsupplied_preferences(self):
        sections = renewal_sections({
            "details": {
                "provider": "Example Energy",
            }
        })

        self.assertNotIn("not supplied", sections["provider_message"])
        self.assertNotIn("My main priority is", sections["provider_message"])
        self.assertNotIn("My switching preference is", sections["provider_message"])


    def test_renewal_provider_message_includes_supplied_prices_and_omits_missing_prices(self):
        sections = renewal_sections({
            "details": {
                "provider": "Example Energy",
                "current_price": "GBP 120 per month",
                "new_quote": "GBP 132 per month",
            }
        })

        self.assertIn("My current price is GBP 120 per month.", sections["provider_message"])
        self.assertIn("My renewal quote is GBP 132 per month.", sections["provider_message"])

        without_prices = renewal_sections({
            "details": {
                "provider": "Example Energy",
            }
        })
        self.assertNotIn("My current price is", without_prices["provider_message"])
        self.assertNotIn("My renewal quote is", without_prices["provider_message"])



class EnergyRenewalFrequencyContractTests(unittest.TestCase):
    def test_price_frequency_fields_offer_reviewed_periods(self):
        fields = {
            field["id"]: field
            for field in domain.fields_for("energy_water", "prepare_renewal")
        }
        expected = ["Monthly", "Annual", "Quarterly", "Weekly", "Other", "Not sure"]

        self.assertEqual(fields["current_price_frequency"]["options"], expected)
        self.assertEqual(fields["renewal_quote_frequency"]["options"], expected)
        self.assertTrue(fields["current_price_frequency"]["recommended"])
        self.assertTrue(fields["renewal_quote_frequency"]["recommended"])

    def test_price_frequency_values_survive_task_normalisation(self):
        task = domain.normalise_task({
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {
                "current_price_frequency": "Monthly",
                "renewal_quote_frequency": "Annual",
            },
        })

        self.assertEqual(task["details"]["current_price_frequency"], "Monthly")
        self.assertEqual(task["details"]["renewal_quote_frequency"], "Annual")

    def test_missing_details_calls_out_price_frequency(self):
        missing = domain.missing_details({
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {},
        })

        self.assertIn("Current price frequency", missing)
        self.assertIn("Renewal quote frequency", missing)


if __name__ == "__main__":
    unittest.main()
