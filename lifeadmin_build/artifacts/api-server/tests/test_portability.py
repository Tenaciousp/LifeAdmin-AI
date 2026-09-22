import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

import storage


class SQLiteStorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / "lifeadmin.sqlite3"
        self.path_patch = patch.object(storage, "SQLITE_PATH", self.path)
        self.path_patch.start()
        self.env_patch = patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False)
        self.env_patch.start()
        storage.ensure_schema()

    def tearDown(self):
        self.env_patch.stop()
        self.path_patch.stop()
        self.tmp.cleanup()

    def test_zero_config_sqlite_account_task_plan_and_purchase_lifecycle(self):
        user = storage.create_user("owner@example.com", "verysecurepassword")
        token = storage.create_session(user["id"])
        self.assertEqual(storage.user_for_session(token)["email"], "owner@example.com")

        task = {
            "id": "11111111-1111-1111-1111-111111111111",
            "title": "Energy tariff ending",
            "category_id": "energy_water",
            "goal_id": "prepare_renewal",
            "status": "Open",
        }
        storage.create_task(user["id"], task)
        self.assertEqual(len(storage.list_tasks(user["id"])), 1)
        updated = storage.update_task(user["id"], task["id"], {"status": "Done"})
        self.assertEqual(updated["status"], "Done")

        note = {
            "id": "22222222-2222-2222-2222-222222222222",
            "task_id": task["id"],
            "title": "Energy plan",
            "source": "fallback",
        }
        storage.add_note(user["id"], note)
        self.assertEqual(storage.list_notes(user["id"])[0]["title"], "Energy plan")

        storage.unlock_purchase(user["id"], "core_app", "test")
        self.assertTrue(storage.get_purchases(user["id"])["core_app"])

        overview = storage.admin_overview()
        self.assertEqual(overview["users"]["total"], 1)
        self.assertEqual(overview["tasks"]["completed"], 1)
        self.assertEqual(overview["purchases"]["core"], 1)

        storage.delete_account(user["id"], "verysecurepassword")
        self.assertIsNone(storage.user_for_session(token))

    def test_duplicate_email_is_rejected(self):
        storage.create_user("same@example.com", "verysecurepassword")
        with self.assertRaises(ValueError):
            storage.create_user("same@example.com", "anothersecurepassword")


class PortableProjectContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = pathlib.Path(__file__).resolve().parents[3]

    def test_frontend_build_has_no_replit_runtime_plugin(self):
        vite = (self.root / "artifacts" / "adminpilot-ai" / "vite.config.ts").read_text(encoding="utf-8")
        package = (self.root / "artifacts" / "adminpilot-ai" / "package.json").read_text(encoding="utf-8")
        self.assertNotIn("@replit/", vite)
        self.assertNotIn("@replit/", package)
        self.assertIn('VITE_API_TARGET', vite)

    def test_root_uses_standard_npm_workspaces(self):
        package = (self.root / "package.json").read_text(encoding="utf-8")
        self.assertIn('"workspaces"', package)
        self.assertIn('"build:web"', package)
        self.assertNotIn('Use pnpm instead', package)

    def test_zero_config_storage_is_sqlite(self):
        with patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False):
            self.assertEqual(storage.backend(), "sqlite")
            self.assertTrue(storage.available())


if __name__ == "__main__":
    unittest.main()
