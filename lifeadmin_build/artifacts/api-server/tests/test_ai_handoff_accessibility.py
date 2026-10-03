import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class AiHandoffAccessibilityRegressionTests(unittest.TestCase):
    def test_handoff_dialog_has_modal_semantics_and_keyboard_escape(self):
        self.assertIn('role="dialog"', SOURCE)
        self.assertIn('aria-modal="true"', SOURCE)
        self.assertIn('aria-labelledby="aiHandoffTitle"', SOURCE)
        self.assertIn('aria-describedby="aiHandoffDescription"', SOURCE)
        self.assertIn('if (event.key === "Escape")', SOURCE)
        self.assertIn('setAiHandoffOpen(false)', SOURCE)

    def test_handoff_dialog_traps_tab_navigation_and_restores_focus(self):
        self.assertIn('if (event.key !== "Tab") return;', SOURCE)
        self.assertIn('const first = focusable[0];', SOURCE)
        self.assertIn('const last = focusable[focusable.length - 1];', SOURCE)
        self.assertIn('last.focus();', SOURCE)
        self.assertIn('first.focus();', SOURCE)
        self.assertIn('aiHandoffReturnFocusRef.current', SOURCE)
        self.assertIn('returnFocusTo?.isConnected', SOURCE)
        self.assertIn('returnFocusTo.focus()', SOURCE)

    def test_handoff_dialog_locks_background_scroll_and_keeps_manual_copy_fallback(self):
        self.assertIn('document.body.style.overflow = "hidden"', SOURCE)
        self.assertIn('document.body.style.overflow = previousOverflow', SOURCE)
        self.assertIn('selectAiPromptForManualCopy', SOURCE)
        self.assertIn('Prompt selected. Use your device', SOURCE)
        self.assertIn('assistantWindow.opener = null', SOURCE)


if __name__ == "__main__":
    unittest.main()
