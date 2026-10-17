import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "backup_data", Path(__file__).resolve().parents[3] / "scripts" / "backup_data.py"
)
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class DataBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        with closing(sqlite3.connect(self.data / "lifeadmin.sqlite3")) as connection:
            with connection:
                connection.execute("CREATE TABLE records (value TEXT)")
                connection.execute("INSERT INTO records VALUES ('synthetic account')")
        (self.data / "notes.json").write_text('{"users":{"synthetic":[]}}')

    def tearDown(self):
        self.temp.cleanup()

    def test_backup_restores_database_and_guest_json(self):
        destination = backup.backup_data(self.data, self.root / "backup")
        with closing(sqlite3.connect(destination / "lifeadmin.sqlite3")) as restored:
            self.assertEqual(restored.execute("SELECT value FROM records").fetchone()[0], "synthetic account")
            self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone()[0], "ok")
        self.assertEqual(json.loads((destination / "notes.json").read_text()), {"users": {"synthetic": []}})
        manifest = json.loads((destination / "manifest.json").read_text())
        self.assertEqual(set(manifest), {"lifeadmin.sqlite3", "notes.json"})
        self.assertEqual((destination.stat().st_mode & 0o777), 0o700)
        self.assertEqual(((destination / "lifeadmin.sqlite3").stat().st_mode & 0o777), 0o600)

    def test_existing_backup_is_not_overwritten(self):
        destination = self.root / "backup"
        destination.mkdir()
        marker = destination / "keep.txt"
        marker.write_text("preserve")
        with self.assertRaises(FileExistsError):
            backup.backup_data(self.data, destination)
        self.assertEqual(marker.read_text(), "preserve")

    def test_invalid_json_rejects_and_removes_partial_backup(self):
        (self.data / "notes.json").write_text("invalid json")
        destination = self.root / "backup"
        with self.assertRaises(json.JSONDecodeError):
            backup.backup_data(self.data, destination)
        self.assertFalse(destination.exists())
