"""Synthetic-only concurrency tests for the API/backup coordination lock."""
import json
import sqlite3
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "artifacts" / "api-server"))
from backup_lock import data_lock, LockTimeout
from backup_data import backup_data


class BackupLockTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        with sqlite3.connect(self.data / "lifeadmin.sqlite3") as db:
            db.execute("CREATE TABLE synthetic (title TEXT)")
            db.execute("INSERT INTO synthetic VALUES ('first')")
        (self.data / "tasks.json").write_text(json.dumps([{"title": "first"}]))

    def test_shared_lock_blocks_backup(self):
        started = threading.Event()
        done = threading.Event()
        results = []

        def run_backup():
            started.set()
            try:
                backup_data(self.data, self.root / "snapshot")
                results.append("ok")
            except Exception as exc:
                results.append(repr(exc))
            finally:
                done.set()

        with data_lock(self.data, timeout=1):
            thread = threading.Thread(target=run_backup)
            thread.start()
            self.assertTrue(started.wait(2))
            self.assertFalse(done.wait(0.2), "Backup ran while request was active")
            (self.data / "tasks.json").write_text(json.dumps([{"title": "second"}]))
        thread.join(4)
        self.assertFalse(thread.is_alive())
        self.assertEqual(results, ["ok"])
        self.assertEqual(
            json.loads((self.root / "snapshot" / "tasks.json").read_text())[0]["title"],
            "second",
        )

    def test_exclusive_lock_rejects_new_requests(self):
        with data_lock(self.data, exclusive=True, timeout=1):
            with self.assertRaises(LockTimeout):
                with data_lock(self.data, timeout=0.08):
                    self.fail("Should not acquire shared lock")
        with data_lock(self.data, timeout=1):
            pass

    def test_failed_backup_releases_lock_and_cleans_snapshot(self):
        (self.data / "tasks.json").write_text("{broken")
        with self.assertRaises(json.JSONDecodeError):
            backup_data(self.data, self.root / "snapshot")
        self.assertFalse((self.root / "snapshot").exists())
        with data_lock(self.data, timeout=0.1):
            pass

    def test_concurrent_readers(self):
        with data_lock(self.data, timeout=1):
            with data_lock(self.data, timeout=0.1):
                pass

    def test_permissions(self):
        with data_lock(self.data, timeout=1):
            pass
        self.assertEqual(
            (self.data / ".lifeadmin-data.lock").stat().st_mode & 0o777, 0o600
        )


if __name__ == "__main__":
    unittest.main()
