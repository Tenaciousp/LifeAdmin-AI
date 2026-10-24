"""Parity and zero-network checks for the first device-local planning functions."""
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest


API = Path(__file__).resolve().parents[1]
MODULE = API.parent / "adminpilot-ai/src/lib/offline/domain.mjs"
spec = importlib.util.spec_from_file_location("offline_parity_reference", API / "domain.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


class OfflineDomainTests(unittest.TestCase):
    def run_client(self, queries):
        # A network attempt must fail rather than accidentally pass a parity test.
        script = """
          globalThis.fetch = () => { throw new Error('Offline domain attempted a request'); };
          const {catalog, suggest} = await import(process.argv[1]);
          let input = '';
          for await (const chunk of process.stdin) input += chunk;
          const queries = JSON.parse(input);
          const original = catalog();
          const changed = catalog();
          changed.categories[0].label = 'mutated';
          changed.categories[0].fields[0].label = 'mutated field';
          console.log(JSON.stringify({
            catalog: original,
            isolated: JSON.stringify(original) === JSON.stringify(catalog()),
            suggestions: queries.map(suggest),
          }));
        """
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script, MODULE.as_uri()],
            input=json.dumps(queries), capture_output=True, text=True, check=True,
            timeout=30,
        )
        return json.loads(result.stdout)

    def test_bundled_catalog_matches_all_current_categories_goals_and_fields(self):
        result = self.run_client([])
        self.assertEqual(json.loads(MODULE.with_name("catalog.json").read_text()), reference.catalog())
        categories = {item["id"]: item for item in result["catalog"]["categories"]}
        self.assertIn("water", categories)
        for item in reference.catalog()["categories"]:
            if item["id"] != "energy_water":
                self.assertEqual(categories[item["id"]], item)
        self.assertTrue(result["isolated"])

    def test_offline_routes_match_server_for_every_synonym_and_goal_pair(self):
        queries = ["", "  ", "fees", "coffee", "unmatched wording"]
        queries += [phrase for item in reference.CATEGORIES + reference.GOALS for phrase in item["synonyms"]]
        queries += [
            category["synonyms"][0] + " " + goal["synonyms"][0]
            for category in reference.CATEGORIES for goal in reference.GOALS
        ]
        result = self.run_client(queries)
        for query, actual in zip(queries, result["suggestions"], strict=True):
            with self.subTest(query=query):
                expected = reference.suggest(query)
                # Native customer UX intentionally separates water from the hosted catalogue.
                if expected.get("prefill_details", {}).get("utility_type") == "Water" or any(word in query.lower() for word in ("water", "united utilities", "severn trent")):
                    self.assertEqual(actual["category_id"], "water")
                    self.assertNotIn(actual["goal_id"], ("cancel_switch", "prepare_renewal"))
                    continue
                actual["popular_categories"] = [item for item in actual["popular_categories"] if item != "water"]
                actual["reasons"] = [reason.replace("energy: gas and electricity", "energy and water") for reason in actual["reasons"]]
                self.assertEqual(actual, expected)

    def test_provider_boundaries_unknown_payments_and_utility_prefill(self):
        queries = [
            "EE price increase", "coffee fees", "SKY too expensive",
            "Netflix cancel", "Disney+ renewal", "Aviva car insurance renewal",
            "unknown card payment", "unrecognised direct debit", "mystery bank charge",
            "British Gas renewal", "Octopus dual fuel ending", "EDF electricity tariff",
            "E.ON gas renewal", "United Utilities water bill", "Thames Water bill",
            "Sky\\nprice", "O2 price", "stop paying gym", "refund wrong charge",
        ]
        result = self.run_client(queries)
        for query, actual in zip(queries, result["suggestions"], strict=True):
            with self.subTest(query=query):
                expected = reference.suggest(query)
                # Native customer UX intentionally separates water from the hosted catalogue.
                if expected.get("prefill_details", {}).get("utility_type") == "Water" or any(word in query.lower() for word in ("water", "united utilities", "severn trent")):
                    self.assertEqual(actual["category_id"], "water")
                    self.assertNotIn(actual["goal_id"], ("cancel_switch", "prepare_renewal"))
                    continue
                actual["popular_categories"] = [item for item in actual["popular_categories"] if item != "water"]
                actual["reasons"] = [reason.replace("energy: gas and electricity", "energy and water") for reason in actual["reasons"]]
                self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
