import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


def function_block(name, next_name):
    start = SOURCE.index(f"const {name}")
    end = SOURCE.index(f"\n\n  const {next_name}", start)
    return SOURCE[start:end]


class PlanResultContextRegressionTests(unittest.TestCase):
    def test_gap_review_does_not_reassign_the_open_result(self):
        block = function_block("handleGenerate", "[lastKnownDetails")
        self.assertIn("setPendingGenerationTask(task)", block)
        self.assertNotIn("setSelectedTaskId(task.id)", block)

    def test_success_assigns_task_context_with_the_new_result(self):
        block = function_block("executeGeneration", "handleEditGaps")
        success_start = block.index("onSuccess:")
        error_start = block.index("onError:")
        success = block[success_start:error_start]
        self.assertIn("setSelectedTaskId(task.id)", success)
        self.assertIn("setPlanResult(data.note.sections)", success)
        self.assertLess(success.index("setSelectedTaskId(task.id)"), success.index("setPlanResult(data.note.sections)"))
        self.assertIn("setPendingGenerationTask(null)", success)

    def test_failure_keeps_previous_result_context_and_clears_pending_task(self):
        block = function_block("executeGeneration", "handleEditGaps")
        error = block[block.index("onError:"):]
        self.assertNotIn("setSelectedTaskId", error)
        self.assertNotIn("setPlanResult", error)
        self.assertIn("setPendingGenerationTask(null)", error)
        self.assertIn("The previous result is still available.", error)

    def test_editing_missing_details_consumes_pending_task_once(self):
        block = function_block("handleEditGaps", "handleAiHandoff")
        self.assertIn("const task = pendingGenerationTask", block)
        self.assertIn("setPendingGenerationTask(null)", block)
        self.assertIn("handleEditTask(task)", block)


if __name__ == "__main__":
    unittest.main()
