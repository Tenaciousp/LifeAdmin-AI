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
        copy_button = '<button onClick={copyAiPrompt} className="min-h-[44px]'
        close_button = '<button onClick={() => setAiHandoffOpen(false)} className="min-h-[44px]'
        self.assertIn(copy_button, SOURCE)
        self.assertIn(close_button, SOURCE)
        self.assertIn("Copy prompt only", SOURCE)
        self.assertIn(">Close</button>", SOURCE)

    def test_popup_failure_keeps_clear_recovery_message(self):
        self.assertIn('window.open("", "_blank")', SOURCE)
        self.assertIn("Allow pop-ups for LifeAdmin and try again.", SOURCE)

    def test_opened_assistant_is_detached_from_lifeadmin_window(self):
        self.assertIn("assistantWindow.opener = null", SOURCE)
        self.assertIn("assistantWindow.location.href = url", SOURCE)

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
