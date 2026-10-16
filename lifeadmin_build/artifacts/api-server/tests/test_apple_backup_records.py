"""Verify real JSON/native SQLite record comparison with synthetic files."""
import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main()
