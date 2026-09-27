import unittest

import app


class EnergyRenewalRoutingTests(unittest.TestCase):
    def test_electricity_renewal_uses_tailored_energy_plan(self):
        task = {
            "title": "Renew electricity tariff",
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {
                "provider": "Example Energy",
                "utility_type": "Electricity",
                "annual_usage": "3200 kWh",
                "unit_rate": "24.5p/kWh",
                "standing_charge": "52p/day",
                "date": "2026-11-30",
            },
        }

        output = app.fallback_agent(task)

        self.assertIn("## Next steps", output)
        self.assertIn("## Provider message", output)
        self.assertIn("## Things to check", output)
        self.assertIn("## Approval checklist", output)
        self.assertIn("annual kWh x unit rate", output)
        self.assertIn("Example Energy", output)

    def test_water_renewal_stays_on_existing_utilities_playbook(self):
        task = {
            "title": "Review water tariff",
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {
                "provider": "Example Water",
                "utility_type": "Water",
            },
        }

        output = app.fallback_agent(task)

        self.assertIn("## Utility account check", output)
        self.assertIn("## Payment and usage check", output)
        self.assertNotIn("annual kWh x unit rate", output)

    def test_water_tariff_label_also_stays_on_existing_utilities_playbook(self):
        task = {
            "title": "Review household utility renewal",
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {
                "provider": "Example Water",
                "tariff": "Water tariff",
            },
        }

        output = app.fallback_agent(task)

        self.assertIn("## Utility account check", output)
        self.assertNotIn("annual kWh x unit rate", output)


if __name__ == "__main__":
    unittest.main()
