"""Bundle reviewed Python guidance as static JSON; never execute Python in the app."""
import ast
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "artifacts/api-server"
OUTPUT = ROOT / "artifacts/adminpilot-ai/src/lib/offline/playbooks.json"


def build():
    spec = importlib.util.spec_from_file_location("playbook_export_domain", API / "domain.py")
    domain = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(domain)
    tree = ast.parse((API / "app.py").read_text())
    functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}
    names = {"detect_playbook", "note_value", "named_subscription_sections", "playbook_sections", "mode_sections", "fallback_agent"}
    constants = {"MODE_PROMPTS", "CATEGORY_PROMPTS", "PROVIDER_MESSAGE_HEADINGS", "APPROVAL_HEADINGS", "THINGS_TO_CHECK_HEADINGS", "OMITTED_RESULT_HEADINGS"}
    selected = [node for node in tree.body if (isinstance(node, ast.FunctionDef) and node.name in names) or
                (isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in constants for t in node.targets))]
    env = {"domain": domain, "re": re}
    exec(compile(ast.Module(body=selected, type_ignores=[]), "<reviewed-playbooks>", "exec"), env)

    def assignment(function, name):
        return next(node.value for node in ast.walk(functions[function]) if isinstance(node, ast.Assign) and
                    any(isinstance(t, ast.Name) and t.id == name for t in node.targets))

    def evaluate(value, **values):
        return eval(compile(ast.Expression(value), "<static-guidance>", "eval"), {"__builtins__": {}}, values)

    provider = "__LIFEADMIN_PROVIDER__"
    base = evaluate(assignment("playbook_sections", "sections"), provider=provider)
    modes = evaluate(assignment("mode_sections", "sections"))
    communication = {}
    for goal in ["check_bill", "challenge_charge", "cancel_switch", "contact_provider"]:
        communication[goal] = env["playbook_sections"]("communications", {"category_id": "tv_broadband_mobile", "goal_id": goal, "details": {"provider": provider}})
    named = {}
    for goal in ["cancel_switch", "challenge_charge", "check_bill"]:
        value = env["named_subscription_sections"]({"category_id": "subscriptions_memberships", "goal_id": goal, "details": {"provider": provider}})
        # One-pass rendering substitutes the complete route without recursively
        # interpreting customer text as a placeholder.
        if goal == "cancel_switch":
            value[1][1][0] = "1. __LIFEADMIN_CANCELLATION_ROUTE__"
        named[goal] = value
    cancellation = ast.literal_eval(assignment("named_subscription_sections", "cancellation_route").func.value)
    return {
        "base": base, "modes": modes, "communications": communication, "named": named,
        "cancellation": cancellation,
        "credit_challenge": env["playbook_sections"]("credit_payment", {"category_id": "credit_loans_finance", "goal_id": "challenge_charge", "details": {"amount": "__LIFEADMIN_AMOUNT__", "date": "__LIFEADMIN_DATE__"}}),
        "council_challenge": env["playbook_sections"]("council_tax", {"category_id": "council_tax_licences", "goal_id": "challenge_charge"}),
        "signals": evaluate(assignment("detect_playbook", "signals")),
        "legacy_category_routes": evaluate(assignment("detect_playbook", "category_map")),
        "headings": {name: sorted(env[name]) for name in constants if name.endswith("_HEADINGS")},
        "general": {key: env["fallback_agent"]({"title": "__LIFEADMIN_TITLE__", "notes": notes})
                    for key, notes in [("with_notes", "__LIFEADMIN_NOTES__"), ("without_notes", "")]},
    }


if __name__ == "__main__":
    OUTPUT.write_text(json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n")
