import pathlib
import re
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "PricingPanel.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class PricingPanelAccessibilityTests(unittest.TestCase):
    def test_loading_and_failure_states_do_not_disappear(self):
        for phrase in (
            "isLoading: productsLoading",
            "isError: productsError",
            "Loading pricing options...",
            "Pricing could not be loaded.",
            "No purchase has been started.",
        ):
            self.assertIn(phrase, SOURCE)
        self.assertIn('role="status"', SOURCE)
        self.assertIn('role="alert"', SOURCE)

    def test_pricing_failure_offers_safe_retry(self):
        self.assertIn("refetch: retryProducts", SOURCE)
        self.assertIn('onClick={() => void retryProducts()}', SOURCE)
        self.assertIn("Retry pricing", SOURCE)

    def test_checkout_busy_state_is_exposed_without_enabling_payments(self):
        self.assertIn("busy={loadingId === \"core_app\"}", SOURCE)
        self.assertIn("busy={loadingId === addon.id}", SOURCE)
        self.assertIn("aria-busy={busy}", SOURCE)
        self.assertIn("!core.checkout_ready", SOURCE)
        self.assertIn("!addon.checkout_ready", SOURCE)

    def test_pricing_region_and_decorative_icons_are_accessible(self):
        self.assertGreaterEqual(SOURCE.count('aria-labelledby="pricing-heading"'), 3)
        exposed = re.findall(r"<(?:ShieldCheck|Check|Lock) className=", SOURCE)
        self.assertEqual(exposed, [])


if __name__ == "__main__":
    unittest.main()
