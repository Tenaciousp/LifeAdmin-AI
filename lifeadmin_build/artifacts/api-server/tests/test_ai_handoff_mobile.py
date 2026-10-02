import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class AiHandoffMobileRegressionTests(unittest.TestCase):
    def test_external_assistant_actions_keep_mobile_touch_targets(self):
        start = SOURCE.index("Recommended free options")
        end = SOURCE.index("Copy prompt only", start)
        actions = SOURCE[start:end]
        self.assertEqual(actions.count("min-h-[48px]"), 2)
        self.assertGreaterEqual(actions.count("min-h-[44px]"), 3)
        for label in ("Gemini", "Copilot", "ChatGPT", "Claude", "Perplexity"):
            self.assertIn(label, actions)

    def test_manual_copy_and_close_actions_keep_mobile_touch_targets(self):
        start = SOURCE.index("Copy prompt only")
        end = SOURCE.index("\n          </div>\n        </div>\n      )}", start)
        actions = SOURCE[start:end]
        self.assertGreaterEqual(actions.count("min-h-[44px]"), 2)
        self.assertIn("Copy prompt only", actions)
        self.assertIn("Close", actions)

    def test_external_assistant_links_stay_explicit_user_actions(self):
        for url in (
            "https://gemini.google.com/",
            "https://copilot.microsoft.com/",
            "https://chatgpt.com/",
            "https://claude.ai/new",
            "https://www.perplexity.ai/",
        ):
            self.assertIn(f'openAiAssistant("{url}"', SOURCE)
        self.assertGreaterEqual(SOURCE.count("<ExternalLink"), 5)


if __name__ == "__main__":
    unittest.main()
