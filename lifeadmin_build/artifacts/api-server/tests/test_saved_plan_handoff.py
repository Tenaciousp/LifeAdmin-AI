import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class SavedPlanHandoffRegressionTests(unittest.TestCase):
    def _handoff_block(self):
        start = SOURCE.index("const handleAiHandoff")
        end = SOURCE.index("\n  const handleCompareWithAi", start)
        return SOURCE[start:end]

    def test_saved_plan_can_supply_context_when_original_task_is_unavailable(self):
        block = self._handoff_block()
        self.assertIn("savedPlans.find((note: any) => note.id === selectedSavedPlanId)", block)
        self.assertIn("if (!task && !savedPlan)", block)
        self.assertNotIn("if (!task || !planResult)", block)

    def test_saved_plan_handoff_uses_clear_generic_fallbacks(self):
        block = self._handoff_block()
        for phrase in (
            'task?.title || savedPlan?.title || "Saved household plan"',
            'task?.category || "Household bill or payment"',
            '"Review this saved plan"',
            "Task: ${taskTitle}",
            "Service: ${service}",
            "Goal: ${goal}",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, block)

    def test_missing_handoff_context_reports_a_recoverable_error(self):
        block = self._handoff_block()
        self.assertIn("This plan's task details are unavailable. Reopen the saved plan and try again.", block)
        self.assertLess(block.index("if (!task && !savedPlan)"), block.index("const prompt ="))

    def test_deleting_original_task_keeps_an_open_saved_plan_visible(self):
        start = SOURCE.index("const handleDeleteTask")
        end = SOURCE.index("\n\n  const handleMarkDone", start)
        block = SOURCE[start:end]
        self.assertIn("if (!selectedSavedPlanId)", block)
        self.assertIn("setSelectedTaskId(null)", block)
        guarded = block[block.index("if (!selectedSavedPlanId)"):]
        self.assertIn("setPlanResult(null)", guarded)
        self.assertIn("setProviderEmail(null)", guarded)
        self.assertIn("setLastKnownDetails([])", guarded)
        self.assertIn("setLastMissingDetails([])", guarded)
        self.assertNotIn("setSelectedSavedPlanId(null)", block)


if __name__ == "__main__":
    unittest.main()
