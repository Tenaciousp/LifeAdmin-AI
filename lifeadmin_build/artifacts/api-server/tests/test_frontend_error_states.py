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

    def test_collection_fetch_failures_do_not_look_like_empty_data(self):
        for phrase in (
            "isError: tasksError, refetch: retryTasks",
            "isError: notesError, refetch: retryNotes",
            "isError: catalogError, refetch: retryCatalog",
            "Categories could not be loaded.",
            "Tasks could not be loaded.",
            "Saved plans could not be loaded.",
            "Your saved tasks have not been removed.",
            "Your plans have not been removed.",
        ):
            self.assertIn(phrase, SOURCE)

        tasks_start = SOURCE.index("{tasksLoading ? (")
        tasks_empty = SOURCE.index("tasks.length === 0", tasks_start)
        self.assertLess(SOURCE.index("tasksError ? (", tasks_start), tasks_empty)

        notes_start = SOURCE.index("{notesLoading ? (")
        notes_empty = SOURCE.index("savedPlans.length === 0", notes_start)
        self.assertLess(SOURCE.index("notesError ? (", notes_start), notes_empty)

    def test_collection_errors_offer_accessible_retry_controls(self):
        for phrase in (
            'onClick={() => void retryCatalog()}',
            'aria-label="Retry category loading"',
            'onClick={() => void retryTasks()}',
            'aria-label="Retry task loading"',
            'onClick={() => void retryNotes()}',
            'aria-label="Retry saved plan loading"',
        ):
            self.assertIn(phrase, SOURCE)
        self.assertGreaterEqual(SOURCE.count('role="alert"'), 3)

    def test_collection_loading_states_are_announced(self):
        self.assertIn('<span className="sr-only">Loading categories...</span>', SOURCE)
        self.assertIn("Loading tasks...", SOURCE)
        self.assertIn('<span className="sr-only">Loading saved plans...</span>', SOURCE)
        self.assertGreaterEqual(SOURCE.count('role="status"'), 3)
        self.assertGreaterEqual(SOURCE.count('<Loader2 aria-hidden="true"'), 3)


if __name__ == "__main__":
    unittest.main()
