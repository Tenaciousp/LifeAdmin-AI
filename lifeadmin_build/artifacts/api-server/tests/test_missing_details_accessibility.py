import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class MissingDetailsDialogAccessibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.effect_start = SOURCE.index("if (!gapModalOpen) return;")
        cls.effect_end = SOURCE.index("\n  }, [gapModalOpen]);", cls.effect_start)
        cls.effect = SOURCE[cls.effect_start:cls.effect_end]

        cls.dialog_start = SOURCE.index("{gapModalOpen && (")
        cls.dialog_end = SOURCE.index("\n\n      {aiHandoffOpen && (", cls.dialog_start)
        cls.dialog = SOURCE[cls.dialog_start:cls.dialog_end]

    def test_dialog_has_programmatic_name_and_description(self):
        for phrase in (
            'role="dialog"',
            'aria-modal="true"',
            'aria-labelledby="gapTitle"',
            'aria-describedby="gapDescription"',
            'id="gapTitle"',
            'id="gapDescription"',
        ):
            self.assertIn(phrase, self.dialog)

    def test_keyboard_focus_stays_inside_and_escape_closes(self):
        self.assertIn('event.key === "Escape"', self.effect)
        self.assertIn("cancelGapReview()", self.effect)
        self.assertIn('event.key !== "Tab"', self.effect)
        self.assertIn("focusable[0]", self.effect)
        self.assertIn("focusable[focusable.length - 1]", self.effect)
        self.assertIn("last.focus()", self.effect)
        self.assertIn("first.focus()", self.effect)

    def test_open_dialog_locks_background_and_restores_focus(self):
        self.assertIn('document.body.style.overflow = "hidden"', self.effect)
        self.assertIn("document.body.style.overflow = previousOverflow", self.effect)
        self.assertIn("dialog.focus()", self.effect)
        self.assertIn("returnFocusTo?.isConnected", self.effect)
        self.assertIn("returnFocusTo.focus()", self.effect)

    def test_cancel_review_clears_pending_request_without_erasing_open_plan(self):
        start = SOURCE.index("const cancelGapReview = () => {")
        end = SOURCE.index("\n  };", start)
        handler = SOURCE[start:end]
        for phrase in (
            "setGapModalOpen(false)",
            "setPendingGenerationTask(null)",
            "setDetectedGaps([])",
            "setActiveStep(planResult ? 6 : 4)",
        ):
            self.assertIn(phrase, handler)
        self.assertNotIn("setPlanResult", handler)
        self.assertNotIn("setSelectedTaskId", handler)
        self.assertIn('onClick={cancelGapReview}', self.dialog)
        self.assertIn("Cancel review", self.dialog)

    def test_failed_second_generation_preserves_prior_plan_workflow_step(self):
        start = SOURCE.index("const executeGeneration = (task: any) => {")
        end = SOURCE.index("\n  const handleEditGaps", start)
        generation = SOURCE[start:end]
        error = generation[generation.index("onError: () => {"):]
        self.assertIn("setActiveStep(planResult ? 6 : 4)", error)
        self.assertNotIn("setPlanResult(null)", error)
        self.assertNotIn("setSelectedTaskId(null)", error)
        self.assertNotIn("setSelectedSavedPlanId(null)", error)

    def test_dialog_fits_dynamic_mobile_viewport_at_zoom(self):
        self.assertIn('style={{ maxHeight: "calc(100dvh - 1rem)" }}', self.dialog)
        self.assertIn("p-2 sm:p-4", self.dialog)
        self.assertIn("p-4 sm:p-6", self.dialog)
        self.assertIn("overflow-y-auto", self.dialog)

    def test_decorative_gap_icon_is_hidden_from_assistive_technology(self):
        self.assertIn('<Info aria-hidden="true"', self.dialog)


if __name__ == "__main__":
    unittest.main()
