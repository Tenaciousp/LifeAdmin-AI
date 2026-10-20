"""Offline synthetic backup tests. No Render, Drive or customer credentials."""
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import secure_backup


class SecureBackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        self.env = patch.dict(os.environ, {"LIFEADMIN_BACKUP_KEY_HEX": "ab" * 32})
        self.env.start()
        self.addCleanup(self.env.stop)
        with sqlite3.connect(self.data / "lifeadmin.sqlite3") as db:
            db.execute("CREATE TABLE accounts (email TEXT)")
            db.execute("INSERT INTO accounts VALUES ('synthetic@example.invalid')")
        (self.data / "tasks.json").write_text(json.dumps([{"title": "Synthetic task"}]))
        (self.data / "notes.json").write_text(json.dumps([{"title": "Synthetic saved plan"}]))
        self.backup = self.root / "backup.labak"

    def test_roundtrip(self):
        secure_backup.create(self.data, self.backup)
        self.assertTrue(self.backup.read_bytes().startswith(secure_backup.MAGIC))
        self.assertNotIn(b"synthetic@example.invalid", self.backup.read_bytes())
        secure_backup.inspect(self.backup)
        restored = self.root / "restored"
        secure_backup.inspect(self.backup, restored)
        with sqlite3.connect(restored / "lifeadmin.sqlite3") as db:
            self.assertEqual(db.execute("SELECT email FROM accounts").fetchone()[0], "synthetic@example.invalid")
        self.assertEqual(json.loads((restored / "notes.json").read_text())[0]["title"], "Synthetic saved plan")
        with sqlite3.connect(restored / "lifeadmin.sqlite3") as db:
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
        with self.assertRaises(FileExistsError):
            secure_backup.inspect(self.backup, restored)
        with self.assertRaises(FileExistsError):
            secure_backup.create(self.data, self.backup)

    def test_wrong_key_and_tampering(self):
        secure_backup.create(self.data, self.backup)
        with patch.dict(os.environ, {"LIFEADMIN_BACKUP_KEY_HEX": "cd" * 32}):
            with self.assertRaises(Exception):
                secure_backup.inspect(self.backup)
        altered = bytearray(self.backup.read_bytes())
        altered[-20] ^= 1
        self.backup.write_bytes(altered)
        with self.assertRaises(Exception):
            secure_backup.inspect(self.backup)

    def test_bad_guest_json(self):
        (self.data / "tasks.json").write_text("{not-json")
        with self.assertRaises(json.JSONDecodeError):
            secure_backup.create(self.data, self.backup)
        self.assertFalse(self.backup.exists())

    def test_refuse_output_inside_data(self):
        with self.assertRaises(ValueError):
            secure_backup.create(self.data, self.data / "unsafe.labak")

    def test_key_validation(self):
        with patch.dict(os.environ, {"LIFEADMIN_BACKUP_KEY_HEX": "not-a-key"}):
            with self.assertRaises(ValueError):
                secure_backup.create(self.data, self.backup)


if __name__ == "__main__":
    unittest.main()
