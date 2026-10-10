"""Synthetic guest-to-account migration recovery; no production data or payments."""
import os
import tempfile
import unittest
from unittest.mock import patch

import app


class GuestMigrationRecoveryTests(unittest.TestCase):
    def test_failed_writes_keep_guest_tasks_and_saved_plans(self):
        with tempfile.TemporaryDirectory() as folder:
            tasks_file = os.path.join(folder, "tasks.json")
            notes_file = os.path.join(folder, "notes.json")
            purchases_file = os.path.join(folder, "purchases.json")
            tasks = [{"id": "task-a"}, {"id": "task-b"}]
            notes = [{"id": "plan-a"}]
            with patch.object(app, "TASKS_FILE", tasks_file), \
                 patch.object(app, "NOTES_FILE", notes_file), \
                 patch.object(app, "PURCHASES_FILE", purchases_file), \
                 patch.object(app.storage, "available", return_value=True), \
                 patch.object(app.storage, "list_tasks", return_value=[]), \
                 patch.object(app.storage, "list_notes", return_value=[]), \
                 patch.object(app.storage, "create_task", side_effect=[None, RuntimeError("outage")]) as create, \
                 patch.object(app.storage, "add_note", side_effect=RuntimeError("outage")):
                app.save_anonymous_items(tasks_file, "guest-a", tasks)
                app.save_anonymous_items(notes_file, "guest-a", notes)
                app.migrate_guest_workspace("guest-a", "account-a")
                self.assertEqual(app.anonymous_items(tasks_file, "guest-a"), [{"id": "task-b"}])
                self.assertEqual(app.anonymous_items(notes_file, "guest-a"), notes)
                self.assertEqual(create.call_count, 2)

    def test_successful_claim_preserves_other_guest(self):
        with tempfile.TemporaryDirectory() as folder:
            tasks_file = os.path.join(folder, "tasks.json")
            notes_file = os.path.join(folder, "notes.json")
            purchases_file = os.path.join(folder, "purchases.json")
            with patch.object(app, "TASKS_FILE", tasks_file), \
                 patch.object(app, "NOTES_FILE", notes_file), \
                 patch.object(app, "PURCHASES_FILE", purchases_file), \
                 patch.object(app.storage, "available", return_value=True), \
                 patch.object(app.storage, "list_tasks", return_value=[]), \
                 patch.object(app.storage, "list_notes", return_value=[]), \
                 patch.object(app.storage, "create_task") as create, \
                 patch.object(app.storage, "add_note") as add:
                app.save_anonymous_items(tasks_file, "guest-a", [{"id": "task-a"}])
                app.save_anonymous_items(tasks_file, "guest-b", [{"id": "task-b"}])
                app.save_anonymous_items(notes_file, "guest-a", [{"id": "plan-a"}])
                app.migrate_guest_workspace("guest-a", "account-a")
                self.assertEqual(app.anonymous_items(tasks_file, "guest-a"), [])
                self.assertEqual(app.anonymous_items(notes_file, "guest-a"), [])
                self.assertEqual(app.anonymous_items(tasks_file, "guest-b"), [{"id": "task-b"}])
                create.assert_called_once()
                add.assert_called_once()

    def test_failed_entitlement_write_keeps_guest_purchase(self):
        with tempfile.TemporaryDirectory() as folder:
            tasks_file = os.path.join(folder, "tasks.json")
            notes_file = os.path.join(folder, "notes.json")
            purchases_file = os.path.join(folder, "purchases.json")
            with patch.object(app, "TASKS_FILE", tasks_file), \
                 patch.object(app, "NOTES_FILE", notes_file), \
                 patch.object(app, "PURCHASES_FILE", purchases_file), \
                 patch.object(app.storage, "available", return_value=True), \
                 patch.object(app.storage, "list_tasks", return_value=[]), \
                 patch.object(app.storage, "list_notes", return_value=[]), \
                 patch.object(app.storage, "unlock_purchase", side_effect=RuntimeError("outage")):
                app.write_json(purchases_file, {"users": {"guest-a": {"core_app": True}}, "stripe_sessions": {}})
                app.migrate_guest_workspace("guest-a", "account-a")
                self.assertTrue(app.load_purchase_store()["users"]["guest-a"]["core_app"])


if __name__ == "__main__":
    unittest.main()
