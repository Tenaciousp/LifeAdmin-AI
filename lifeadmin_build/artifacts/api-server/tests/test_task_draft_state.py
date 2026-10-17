import pathlib
import unittest


SOURCE_PATH = pathlib.Path(__file__).resolve().parents[2] / "adminpilot-ai" / "src" / "components" / "CustomerJourney.tsx"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


def function_block(name: str, next_name: str) -> str:
    start = SOURCE.index(f"const {name}")
    end = SOURCE.index(f"const {next_name}", start)
    return SOURCE[start:end]


class TaskDraftStateTests(unittest.TestCase):
    def test_search_suggestion_starts_a_fresh_medium_priority_task(self):
        block = function_block("acceptSuggestion", "handleCategorySelect")
        self.assertIn("setEditingId(null)", block)
        self.assertIn('setPriority("Medium")', block)

    def test_manual_category_choice_starts_a_fresh_medium_priority_task(self):
        block = function_block("handleCategorySelect", "currentCategoryObj")
        self.assertIn("setEditingId(null)", block)
        self.assertIn('setPriority("Medium")', block)

    def test_successful_create_clears_goal_and_priority_for_the_next_task(self):
        start = SOURCE.index("createTask.mutate(payload")
        end = SOURCE.index("onError:", start)
        block = SOURCE[start:end]
        self.assertIn("setSelectedCategory(null)", block)
        self.assertIn("setSelectedGoal(null)", block)
        self.assertIn('setPriority("Medium")', block)

    def test_change_category_clears_the_previous_priority(self):
        start = SOURCE.index("setSelectedCategory(null);", SOURCE.index("Selected Category"))
        end = SOURCE.index("setActiveStep(1);", start)
        self.assertIn('setPriority("Medium")', SOURCE[start:end])

    def test_editing_still_restores_the_saved_task_priority(self):
        block = function_block("handleEditTask", "handleDeleteTask")
        self.assertIn('setPriority(t.priority || "Medium")', block)


if __name__ == "__main__":
    unittest.main()
