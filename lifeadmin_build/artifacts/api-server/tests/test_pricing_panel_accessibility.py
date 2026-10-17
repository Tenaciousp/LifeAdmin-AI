import pathlib
import unittest

SRC = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src"
SOURCE = (SRC / "components" / "PricingPanel.tsx").read_text(encoding="utf-8")
LANDING = (SRC / "pages" / "LandingPage.tsx").read_text(encoding="utf-8")
HERO = (SRC / "components" / "LandingHero.tsx").read_text(encoding="utf-8")

class AppHelpAccessibilityTests(unittest.TestCase):
    def test_app_has_help_links_without_pricing_or_checkout(self):
        for text in (SOURCE, LANDING, HERO):
            self.assertNotIn("£1.99", text)
        self.assertNotIn("/api/checkout", SOURCE)
        self.assertNotIn("<PricingPanel", LANDING)
        self.assertIn("<AppHelpPanel />", LANDING)
        self.assertIn("https://tenaciouspl.co.uk/#example", SOURCE)
        self.assertIn("https://tenaciouspl.co.uk/#contact", SOURCE)
        self.assertIn("mailto:tenaciouspl@icloud.com", SOURCE)

    def test_help_links_are_named_and_keyboard_accessible(self):
        self.assertIn('aria-labelledby="support-heading"', SOURCE)
        self.assertIn('id="support-heading"', SOURCE)
        self.assertEqual(SOURCE.count('rel="noopener noreferrer"'), 2)
        self.assertEqual(SOURCE.count("(opens in a new tab)"), 2)
        self.assertEqual(SOURCE.count("min-h-[44px]"), 3)
        self.assertEqual(SOURCE.count("focus-visible:ring-2"), 3)

if __name__ == "__main__":
    unittest.main()
