import unittest
from test_portability import SQLiteStorageTests
import storage


class AccountIsolationTests(SQLiteStorageTests):
    def test_two_customers_cannot_access_each_others_data(self):
        alice = storage.create_user("alice@example.com", "testpassword123")
        bob = storage.create_user("bob@example.com", "testpassword456")

        task = {
            "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "title": "Alice private bill",
            "status": "Open",
        }
        storage.create_task(alice["id"], task)

        note = {
            "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "task_id": task["id"],
            "title": "Alice private plan",
        }
        storage.add_note(alice["id"], note)
        storage.unlock_purchase(alice["id"], "core_app", "test")

        self.assertEqual(storage.list_tasks(bob["id"]), [])
        self.assertEqual(storage.list_notes(bob["id"]), [])
        self.assertEqual(storage.get_purchases(bob["id"]), {})

        self.assertIsNone(
            storage.update_task(bob["id"], task["id"], {"status": "Done"})
        )
        self.assertFalse(storage.delete_task(bob["id"], task["id"]))
        self.assertFalse(storage.delete_note(bob["id"], note["id"]))

        self.assertEqual(storage.list_tasks(alice["id"])[0]["status"], "Open")
        self.assertEqual(storage.list_notes(alice["id"])[0]["title"], "Alice private plan")
        self.assertTrue(storage.get_purchases(alice["id"])["core_app"])


if __name__ == "__main__":
    unittest.main()
