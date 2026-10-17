"""Verify local energy output against the existing reviewed server function."""
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import unittest

API = Path(__file__).resolve().parents[1]
MODULE = API.parent / "adminpilot-ai/src/lib/offline/energy-renewal.mjs"
spec = importlib.util.spec_from_file_location("offline_energy_reference", API / "energy_renewal.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


class OfflineEnergyTests(unittest.TestCase):
    def local(self, tasks):
        script = """
          globalThis.fetch = () => { throw new Error('Unexpected network request'); };
          const {renewalSections} = await import(process.argv[1]);
          let input = '';
          for await (const chunk of process.stdin) input += chunk;
          console.log(JSON.stringify(JSON.parse(input).map(renewalSections)));
        """
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script, MODULE.as_uri()],
            input=json.dumps(tasks), capture_output=True, text=True, check=True, timeout=30,
        )
        return json.loads(result.stdout)

    def test_all_billing_period_combinations_preserve_existing_guidance(self):
        periods = ["Monthly", "Annual", "Quarterly", "Weekly", "Other", "Not sure", ""]
        tasks = [{"details": {
            "provider": "Example Energy", "utility_type": "Dual fuel",
            "current_price": "£120", "new_quote": "£1,500",
            "current_price_frequency": current, "renewal_quote_frequency": renewal,
        }} for current, renewal in itertools.product(periods, repeat=2)]
        for task, actual in zip(tasks, self.local(tasks), strict=True):
            with self.subTest(details=task["details"]):
                self.assertEqual(actual, reference.renewal_sections(task))

    def test_missing_data_aliases_and_supplied_preferences_match_server(self):
        complete = {
            "provider": " Example Energy ", "account_reference": "TEST-123",
            "utility_type": "Dual fuel", "annual_usage": "electricity 2900 kWh; gas 11500 kWh",
            "tariff": "Fixed", "unit_rate": "24p/kWh; 6p/kWh",
            "standing_charge": "50p/day; 30p/day", "amount": "£125",
            "current_price_frequency": "Monthly", "new_quote": "£1600",
            "renewal_quote_frequency": "Annual", "date": "2027-02-01",
            "exit_fee": "£50 per fuel", "renewal_priority": "Keep the same cover / service",
            "switch_willingness": "Only want a retention deal",
        }
        tasks = [{}, {"details": None}, {"details": []}, {"details": complete}]
        tasks += [{"details": {**complete, key: ""}} for key in complete]
        tasks += [{"details": {**complete, "current_price": "£130", "renewal_date": "2027-03-01"}}]
        for task, actual in zip(tasks, self.local(tasks), strict=True):
            with self.subTest(task=task):
                self.assertEqual(actual, reference.renewal_sections(task))


if __name__ == "__main__":
    unittest.main()
