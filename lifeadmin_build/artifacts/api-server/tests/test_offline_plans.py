"""Compare local result envelopes with reviewed Python guidance, without a server."""
import ast
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import unittest

API = Path(__file__).resolve().parents[1]
MODULE = API.parent / "adminpilot-ai/src/lib/offline/plans.mjs"


def load_reference(name):
    spec = importlib.util.spec_from_file_location("plan_reference_" + name, API / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


domain = load_reference("domain")
energy = load_reference("energy_renewal")
# Load only pure contract functions/constants, never app startup, storage or secrets.
names = {"structured_result", "safety_notice", "result_contract"}
constants = {"OMITTED_RESULT_HEADINGS", "PROVIDER_MESSAGE_HEADINGS", "APPROVAL_HEADINGS", "THINGS_TO_CHECK_HEADINGS"}
tree = ast.parse((API / "app.py").read_text())
nodes = [node for node in tree.body if
         (isinstance(node, ast.FunctionDef) and node.name in names) or
         (isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id in constants for target in node.targets))]
reference = {"domain": domain, "re": re, "json": json}
exec(compile(ast.Module(body=nodes, type_ignores=[]), "<pure-plan-reference>", "exec"), reference)


class OfflinePlanTests(unittest.TestCase):
    def local(self, method, tasks):
        script = """
          globalThis.fetch = () => { throw new Error('Unexpected network request'); };
          const module = await import(process.argv[1]);
          let input = '';
          for await (const chunk of process.stdin) input += chunk;
          console.log(JSON.stringify(JSON.parse(input).map(module[process.argv[2]])));
        """
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script, MODULE.as_uri(), method],
            input=json.dumps(tasks), capture_output=True, text=True, check=True, timeout=30,
        )
        return json.loads(result.stdout)

    def test_missing_details_for_every_category_and_goal(self):
        tasks = [{"category_id": category["id"], "goal_id": goal["id"], "details": {}}
                 for category in domain.CATEGORIES for goal in domain.GOALS]
        self.assertEqual(self.local("missingDetails", tasks), [domain.missing_details(task) for task in tasks])

    def test_normalisation_preserves_scalar_details_and_legacy_categories(self):
        tasks = [
            {"category": "Gas, electricity or water", "details": {"provider": "Example", "blank": "", "zero": 0, "flag": True}},
            {"category_id": "invalid", "goal_id": "invalid", "details": None},
            {"category_id": "insurance", "goal_id": "prepare_renewal", "details": {"notes": "🌍" * 600}},
        ]
        self.assertEqual(self.local("normaliseTask", tasks), [domain.normalise_task(task) for task in tasks])

    def test_all_existing_safety_notices_are_preserved(self):
        tasks = [
            {"category_id": category, "notes": note}
            for category in ["energy_water", "rent_mortgage_property", "insurance", "other_regular_payment"]
            for note in ["fraud and unauthorised payment", "cannot pay arrears disconnection",
                         "eviction section 21 repossession", "urgent claim after flood", "ordinary renewal"]
        ]
        self.assertEqual(self.local("safetyNotices", tasks), [reference["safety_notice"](task) for task in tasks])

    def test_local_energy_and_unknown_payment_envelopes_match_server(self):
        tasks = [
            {"title": "Energy renewal", "category_id": "energy_water", "goal_id": "prepare_renewal", "details": details}
            for details in [{}, {"provider": "Example Energy", "account_reference": "TEST",
                                "amount": "£100", "current_price_frequency": "Monthly",
                                "new_quote": "£1300", "renewal_quote_frequency": "Annual"}]
        ]
        tasks += [
            {"title": "Unknown charge", "category_id": "other_regular_payment", "goal_id": "identify_payment",
             "notes": note, "details": {"statement_description": "EXAMPLE", "amount": "£12", "date": "2026-10-01"}}
            for note in ["", "suspected fraud"]
        ]
        tasks += [{"title": "Renewal", "category_id": "energy_water", "goal_id": "prepare_renewal",
                   "notes": "cannot pay arrears", "details": {}}]
        for task, actual in zip(tasks, self.local("generateLocalResult", tasks), strict=True):
            if domain.is_unknown_payment(task):
                sections = domain.unknown_payment_sections(task)
                text = "\n\n".join(["# Admin plan: " + task["title"], "## Next steps\n" + sections["next_steps"],
                                     "## Things to check\n" + sections["things_to_check"], "## Approval checklist\n" + sections["approval_checklist"]])
            else:
                sections = energy.renewal_sections(domain.normalise_task(task))
                text = "\n\n".join("## " + heading + "\n" + sections[key] for key, heading in [
                    ("next_steps", "Next steps"), ("provider_message", "Provider message"),
                    ("things_to_check", "Things to check"), ("approval_checklist", "Approval checklist")])
            self.assertEqual(actual, {"content": text, **reference["result_contract"](text, task)})

    def test_local_generation_and_storage_integration(self):
        result = subprocess.run(["node", "--test", str(MODULE.with_name("plans.test.mjs"))],
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
