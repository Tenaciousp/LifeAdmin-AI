import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch

import app


class Handler:
    def __init__(self, body):
        raw = json.dumps(body).encode("utf-8")
        self.path = "/api/agent"
        self.headers = {"Content-Length": str(len(raw))}
        self.rfile = io.BytesIO(raw)
        self.wfile = io.BytesIO()
        self.client_address = ("test-client", 1)
        self.status = None
        self._guest_cookie = None

    def send_response(self, status):
        self.status = status

    def send_header(self, name, value):
        pass

    def end_headers(self):
        pass

    def payload(self):
        return json.loads(self.wfile.getvalue().decode("utf-8"))


class EnergyRenewalRouteBehaviourTests(unittest.TestCase):
    def test_route_preserves_renewal_context(self):
        task = {
            "id": "energy-renewal-test",
            "title": "Review energy renewal",
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "details": {
                "provider": "Example Energy",
                "utility_type": "Dual fuel",
                "current_price": "GBP 118",
                "current_price_frequency": "Monthly",
                "new_quote": "GBP 1,572",
                "renewal_quote_frequency": "Annual",
                "renewal_date": "15 November 2026",
                "renewal_priority": "Lowest total cost",
                "switch_willingness": "Happy to switch",
            },
        }
        with tempfile.TemporaryDirectory() as tmpdir,              patch.object(app, "NOTES_FILE", os.path.join(tmpdir, "notes.json")),              patch.object(app, "current_user", return_value=None),              patch.object(app, "guest_session", return_value="guest-energy"),              patch.object(app, "agent_rate_limited", return_value=False),              patch.object(app, "is_mode_unlocked", return_value=True),              patch.object(
                 app,
                 "call_openai",
                 side_effect=lambda supplied_task, mode: (
                     app.fallback_agent(supplied_task, mode),
                     "fallback",
                 ),
             ):
            handler = Handler({"task": task, "mode": "full"})
            app.AdminPilotHandler.do_POST(handler)

        self.assertEqual(handler.status, 200)
        note = handler.payload()["note"]
        message = note["sections"]["provider_message"]
        self.assertIn("Example Energy", message)
        self.assertIn("GBP 118 (Monthly)", message)
        self.assertIn("GBP 1,572 (Annual)", message)
        self.assertIn("15 November 2026", message)
        self.assertIn("billing period for both my current price and renewal quote", message)
        self.assertEqual(note["known_details"]["current_price_frequency"], "Monthly")
        self.assertEqual(note["known_details"]["renewal_quote_frequency"], "Annual")
        self.assertIn("same annual basis", note["sections"]["next_steps"])
        self.assertIn(
            "Price-period comparison: ready for same-period annualisation.",
            note["sections"]["things_to_check"],
        )
        self.assertIn(
            "Current and renewal price frequency confirmed and converted to the same comparison period.",
            note["sections"]["approval_checklist"],
        )
        self.assertIn("Lowest total cost", message)
        self.assertIn("Happy to switch", message)


if __name__ == "__main__":
    unittest.main()
