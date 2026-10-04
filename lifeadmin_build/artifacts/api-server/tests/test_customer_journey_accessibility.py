import pathlib
import re
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class CustomerJourneyAccessibilityTests(unittest.TestCase):
    def test_optional_task_name_has_programmatic_label(self):
        self.assertIn('htmlFor="task-name"', SOURCE)
        self.assertIn('id="task-name"', SOURCE)
        self.assertIn(">Task name</label>", SOURCE)

    def test_popular_choices_are_exposed_as_a_named_group(self):
        self.assertIn('id="popular-choices-label"', SOURCE)
        self.assertIn('role="group" aria-labelledby="popular-choices-label"', SOURCE)
        self.assertNotIn(">Popular choices</label>", SOURCE)

    def test_result_and_handoff_icons_are_decorative(self):
        icon_names = "Zap|ChevronDown|Loader2|Copy|Bot|MoreHorizontal|Mail|ExternalLink"
        exposed = re.findall(rf"<(?:{icon_names}) className=", SOURCE)
        self.assertEqual(exposed, [])
        self.assertGreaterEqual(SOURCE.count('aria-hidden="true"'), 20)

    def test_plan_generation_is_announced_as_status(self):
        start = SOURCE.index("generatePlan.isPending ? (")
        end = SOURCE.index(") : !planResult ? (", start)
        block = SOURCE[start:end]
        self.assertIn('role="status"', block)
        self.assertIn('<Loader2 aria-hidden="true"', block)
        self.assertIn("Generating your custom admin plan...", block)


if __name__ == "__main__":
    unittest.main()
