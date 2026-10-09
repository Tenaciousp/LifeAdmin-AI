"""Offline HTTP integration tests for backup maintenance locks.

Uses localhost, temporary synthetic SQLite/JSON, and no external services.
"""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1] / "artifacts" / "api-server"
sys.path.insert(0, str(API_DIR))
import app
import storage
from backup_lock import data_lock


class HttpBackupLockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="lifeadmin-http-lock-")
        cls.data = Path(cls.tmp.name) / "data"
        cls.data.mkdir()
        cls.patchers = [
            patch.object(app, "DATA_DIR", str(cls.data)),
            patch.object(app, "TASKS_FILE", str(cls.data / "tasks.json")),
            patch.object(app, "NOTES_FILE", str(cls.data / "notes.json")),
            patch.object(app, "SETTINGS_FILE", str(cls.data / "settings.json")),
            patch.object(app, "PURCHASES_FILE", str(cls.data / "purchases.json")),
            patch.object(storage, "DATA_DIR", cls.data),
            patch.object(storage, "SQLITE_PATH", cls.data / "lifeadmin.sqlite3"),
            patch.dict(os.environ, {"APP_ENV": "production", "DEMO_PAYMENTS": "false"}, clear=False),
        ]
        for patcher in cls.patchers:
            patcher.start()
        app.ensure_data()
        storage.ensure_schema()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), app.AdminPilotHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        for patcher in reversed(cls.patchers):
            patcher.stop()
        cls.tmp.cleanup()

    def request(self, route, body=None):
        payload = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.server.server_port}{route}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST" if body is not None else "GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status, dict(response.headers), json.load(response)
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), json.load(exc)

    def test_health_remains_available_during_backup(self):
        with data_lock(self.data, exclusive=True, timeout=1):
            status, _, payload = self.request("/api/health")
            self.assertEqual((status, payload["status"]), (200, "ok"))

    def test_guest_reads_blocked_and_resume(self):
        with data_lock(self.data, exclusive=True, timeout=1):
            status, headers, payload = self.request("/api/tasks")
            self.assertEqual(status, 503)
            self.assertEqual(headers.get("Retry-After"), "2")
            self.assertIn("maintenance", payload["error"])
        status, _, payload = self.request("/api/tasks")
        self.assertEqual(status, 200)
        self.assertIn("tasks", payload)

    def test_registration_blocked_then_succeeds(self):
        details = {"email": "synthetic-lock@example.invalid", "password": "synthetic-password-123"}
        with data_lock(self.data, exclusive=True, timeout=1):
            status, _, _ = self.request("/api/auth/register", details)
            self.assertEqual(status, 503)
        status, _, payload = self.request("/api/auth/register", details)
        self.assertEqual(status, 201)
        self.assertIn("user", payload)

    def test_webhook_blocked_during_backup(self):
        with data_lock(self.data, exclusive=True, timeout=1):
            status, _, _ = self.request("/api/stripe/webhook", {"id": "synthetic"})
            self.assertEqual(status, 503)


if __name__ == "__main__":
    unittest.main()
