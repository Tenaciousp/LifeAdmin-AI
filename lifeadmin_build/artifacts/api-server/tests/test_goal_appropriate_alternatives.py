import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class GoalAppropriateAlternativeRegressionTests(unittest.TestCase):
    def test_comparison_action_is_limited_to_supported_categories(self):
        self.assertIn("const ALTERNATIVE_COMPARISON_CATEGORIES = new Set([", SOURCE)
        for category in (
            "tv_broadband_mobile",
            "energy_water",
            "insurance",
            "subscriptions_memberships",
            "home_security_maintenance",
        ):
            self.assertIn(f'"{category}"', SOURCE)
        self.assertIn("!ALTERNATIVE_COMPARISON_CATEGORIES.has(task.category_id)", SOURCE)

    def test_insurance_comparison_prompt_uses_like_for_like_policy_terms(self):
        start = SOURCE.index('if (task?.category_id === "insurance")')
        end = SOURCE.index('if (task?.category_id === "subscriptions_memberships")', start)
        block = SOURCE[start:end]
        for phrase in (
            "same cover basis",
            "annual premium",
            "compulsory and voluntary excess",
            "cover limits",
            "major exclusions",
            "like-for-like comparison",
            "current and renewal premium",
        ):
            self.assertIn(phrase, block)

    def test_subscription_comparison_prompt_covers_cost_and_cancellation_routes(self):
        start = SOURCE.index('if (task?.category_id === "subscriptions_memberships")')
        end = SOURCE.index("Find at least five realistic alternatives", start)
        block = SOURCE[start:end]
        for phrase in (
            "monthly and annual price",
            "minimum term",
            "cancellation route",
            "removing unused extras",
            "cancellation fee",
            "notice period",
            "features I said I must keep",
        ):
            self.assertIn(phrase, block)


if __name__ == "__main__":
    unittest.main()
