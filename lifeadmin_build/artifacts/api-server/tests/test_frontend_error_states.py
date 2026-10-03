import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


class FrontendErrorStateRegressionTests(unittest.TestCase):
    def test_task_action_failures_keep_clear_recovery_copy(self):
        for phrase in (
            "Task update failed. Your changes are still on screen. Try again.",
            "Task save failed. Your details are still on screen. Try again.",
            "Task removal failed. Try again.",
            "Status update failed. Try again.",
            "Plan generation failed. Your task is still saved. Try again.",
        ):
            self.assertIn(phrase, SOURCE)

        start = SOURCE.index("const executeGeneration")
        end = SOURCE.index("\n\n  const handleEditGaps", start)
        self.assertIn("setActiveStep(4)", SOURCE[start:end])

    def test_pending_task_actions_block_duplicate_submissions(self):
        for phrase in (
            "disabled={createTask.isPending || updateTask.isPending}",
            "aria-busy={createTask.isPending || updateTask.isPending}",
            "disabled={generatePlan.isPending}",
            "aria-busy={generatePlan.isPending}",
            "disabled={updateTask.isPending}",
            "aria-busy={updateTask.isPending}",
            "disabled={deleteTask.isPending}",
            "aria-busy={deleteTask.isPending}",
        ):
            self.assertIn(phrase, SOURCE)

    def test_pending_task_actions_show_clear_mobile_feedback(self):
        for phrase in (
            'createTask.isPending ? "Saving task..."',
            'updateTask.isPending ? "Updating task..."',
            'generatePlan.isPending ? "Generating..."',
            'updateTask.isPending ? "Updating..."',
            'deleteTask.isPending ? `Deleting ${t.title}` : `Delete ${t.title}`',
            'aria-live="polite"',
        ):
            self.assertIn(phrase, SOURCE)

        actions_start = SOURCE.index('<div className="flex flex-wrap gap-2 mt-4" aria-live="polite">')
        actions_end = SOURCE.index("\n                  </div>", actions_start)
        actions = SOURCE[actions_start:actions_end]
        self.assertIn('handleMarkDone(t)} disabled={updateTask.isPending}', actions)
        self.assertIn('className="min-h-[44px]', actions)
        self.assertNotIn('min-h-[40px]', actions)


if __name__ == "__main__":
    unittest.main()
