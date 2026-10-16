"""Verify real JSON/native SQLite record comparison with synthetic files."""
import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "apple_runner", Path(__file__).resolve().parents[3] / "scripts/smoke_apple_simulator.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ExportedRecordTests(unittest.TestCase):
    def test_exact_records_and_changed_plan_are_distinguished(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            exported = {"format": "lifeadmin-backup", "version": 1,
                        "exported_at": "export-time",
                        "tasks": [{"id": "bill", "title": "Synthetic", "notes": "Note7319",
                                   "details": {"provider": "Netflix", "account_reference": "REF-7319"}}],
                        "plans": [{"id": "plan", "task_id": "bill", "content": "Original full plan",
                                   "sections": {"next_steps": "Retain this section"}}]}
            backup = folder / "backup.json"
            backup.write_text(json.dumps(exported))
            database = folder / "records.sqlite"
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("CREATE TABLE snapshot (id INTEGER PRIMARY KEY, data TEXT)")
                restored = {**exported, "exported_at": "restore-time"}
                connection.execute("INSERT INTO snapshot VALUES (1, ?)", (json.dumps(restored),))
            result = runner.verify_exported_records(backup, database)
            self.assertTrue(result["exact_record_match"])
            self.assertTrue(result["synthetic_details_preserved"])
            restored["plans"][0]["sections"]["next_steps"] = "Changed section"
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("UPDATE snapshot SET data=?", (json.dumps(restored),))
            with self.assertRaisesRegex(RuntimeError, "differ"):
                runner.verify_exported_records(backup, database)
            with closing(sqlite3.connect(database)) as connection, connection:
                self.assertEqual(json.loads(connection.execute("SELECT data FROM snapshot").fetchone()[0]), restored)

    def test_matching_records_still_require_the_known_synthetic_details(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            data = {"format": "lifeadmin-backup", "version": 1,
                    "tasks": [{"id": "bill", "details": {}, "notes": ""}],
                    "plans": [{"id": "plan", "task_id": "bill", "content": "Plan"}]}
            backup = folder / "backup.json"
            backup.write_text(json.dumps(data))
            database = folder / "records.sqlite"
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("CREATE TABLE snapshot (id INTEGER PRIMARY KEY, data TEXT)")
                connection.execute("INSERT INTO snapshot VALUES (1, ?)", (json.dumps(data),))
            with self.assertRaisesRegex(RuntimeError, "details"):
                runner.verify_exported_records(backup, database)


    def test_invalid_fixtures_preserve_the_export_and_cover_native_size_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            backup = folder / "lifeadmin-backup.json"
            original = {"format": "lifeadmin-backup", "version": 1,
                        "tasks": [{"id": "bill", "title": "Synthetic"}],
                        "plans": [{"id": "plan", "task_id": "bill", "content": "Original"}]}
            backup.write_text(json.dumps(original))
            before = backup.read_bytes()
            runner.create_invalid_backups(backup)
            self.assertEqual(backup.read_bytes(), before)
            self.assertEqual(json.loads((folder / "ci-future.json").read_text())["version"], 2)
            invalid = json.loads((folder / "ci-invalid-plan.json").read_text())
            self.assertIsInstance(invalid["plans"][0]["missing_details"], str)
            self.assertEqual((folder / "ci-oversized.json").stat().st_size, 5 * 1024 * 1024 + 1)
            with self.assertRaises(json.JSONDecodeError):
                json.loads((folder / "ci-malformed.json").read_text())


    def test_native_verification_follows_relocated_app_container(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            data = {"format": "lifeadmin-backup", "version": 1,
                    "tasks": [{"id": "bill", "notes": "Note7319",
                               "details": {"provider": "Netflix", "account_reference": "REF-7319"}}],
                    "plans": [{"id": "plan", "task_id": "bill", "content": "Synthetic plan"}]}
            backup = folder / "lifeadmin-backup.json"
            backup.write_text(json.dumps(data))
            original = folder / "original-container"
            relocated = folder / "relocated-container"
            database = original / "Library/Application Support/LifeAdmin/records-v1.sqlite"
            database.parent.mkdir(parents=True)
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("CREATE TABLE snapshot (id INTEGER PRIMARY KEY, data TEXT)")
                connection.execute("INSERT INTO snapshot VALUES (1, ?)", (json.dumps(data),))
            with patch.object(runner, "sim", return_value=str(original)) as resolve_container:
                self.assertTrue(runner.verify_device_records("device", "bundle", backup)["exact_record_match"])
                original.rename(relocated)
                resolve_container.return_value = str(relocated)
                self.assertTrue(runner.verify_device_records("device", "bundle", backup)["exact_record_match"])
            self.assertFalse(original.exists())


    def test_staging_inspection_rejects_leftovers_without_deleting_files(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            with patch.object(runner, "sim", return_value=str(folder)):
                with self.assertRaisesRegex(RuntimeError, "unavailable"):
                    runner.verify_export_staging_removed("device", "bundle")
                temporary = folder / "tmp"
                temporary.mkdir()
                saved = temporary / "unrelated.json"
                saved.write_text("Keep this file")
                runner.verify_export_staging_removed("device", "bundle")
                staged = temporary / "lifeadmin-export-123"
                staged.mkdir()
                (staged / "lifeadmin-backup.json").write_text("Private copy")
                with self.assertRaisesRegex(RuntimeError, "staging copy"):
                    runner.verify_export_staging_removed("device", "bundle")
                self.assertTrue(staged.exists())
                self.assertEqual(saved.read_text(), "Keep this file")


    def test_injected_native_write_rejection_rolls_back_and_is_removable(self):
        with tempfile.TemporaryDirectory() as directory:
            container = Path(directory)
            database = container / "Library/Application Support/LifeAdmin/records-v1.sqlite"
            database.parent.mkdir(parents=True)
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("CREATE TABLE snapshot (id INTEGER PRIMARY KEY, revision TEXT, data TEXT)")
                connection.execute("INSERT INTO snapshot VALUES (1, 'original', 'Original records')")
            with patch.object(runner, "sim", return_value=str(container)):
                runner.configure_write_failure("device", "bundle", True)
                with closing(sqlite3.connect(database)) as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    with self.assertRaisesRegex(sqlite3.IntegrityError, "Synthetic CI write rejection"):
                        connection.execute("INSERT OR REPLACE INTO snapshot VALUES (1, 'changed', 'Changed records')")
                    connection.rollback()
                    self.assertEqual(connection.execute("SELECT revision, data FROM snapshot").fetchone(),
                                     ("original", "Original records"))
                runner.configure_write_failure("device", "bundle", False)
                with closing(sqlite3.connect(database)) as connection, connection:
                    connection.execute("INSERT OR REPLACE INTO snapshot VALUES (1, 'recovered', 'Recovered save')")
                    self.assertEqual(connection.execute("SELECT revision, data FROM snapshot").fetchone(),
                                     ("recovered", "Recovered save"))
            database.unlink()
            with patch.object(runner, "sim", return_value=str(container)):
                with self.assertRaises(sqlite3.OperationalError):
                    runner.configure_write_failure("device", "bundle", True)
            self.assertFalse(database.exists())


    def test_future_storage_fixture_changes_only_version_and_restores_it(self):
        with tempfile.TemporaryDirectory() as directory:
            container = Path(directory)
            database = container / "Library/Application Support/LifeAdmin/records-v1.sqlite"
            database.parent.mkdir(parents=True)
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("PRAGMA user_version=1")
                connection.execute("CREATE TABLE snapshot (id INTEGER PRIMARY KEY, revision TEXT, data TEXT)")
                connection.execute("INSERT INTO snapshot VALUES (1, 'original', 'Original records')")
            with patch.object(runner, "sim", return_value=str(container)):
                self.assertEqual(runner.configure_storage_version("device", "bundle", 2), 1)
                with closing(sqlite3.connect(database)) as connection:
                    self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 2)
                    self.assertEqual(connection.execute("SELECT * FROM snapshot").fetchone(),
                                     (1, "original", "Original records"))
                self.assertEqual(runner.configure_storage_version("device", "bundle", 1), 2)
                with closing(sqlite3.connect(database)) as connection:
                    self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 1)
                    self.assertEqual(connection.execute("SELECT * FROM snapshot").fetchone(),
                                     (1, "original", "Original records"))
                with self.assertRaises(ValueError):
                    runner.configure_storage_version("device", "bundle", 3)
            database.unlink()
            with patch.object(runner, "sim", return_value=str(container)):
                with self.assertRaises(sqlite3.OperationalError):
                    runner.configure_storage_version("device", "bundle", 2)
            self.assertFalse(database.exists())


if __name__ == "__main__":
    unittest.main()


