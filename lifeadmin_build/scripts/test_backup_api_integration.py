"""Run the real LifeAdmin HTTP server against synthetic data only.

Starts a disposable copy of the Python API on localhost. Never connects to
Render, Google Drive, Stripe, or a production database.
"""
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "artifacts" / "api-server"
sys.path.insert(0, str(API))
from backup_lock import data_lock
from backup_data import backup_data


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class LiveBackupIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="lifeadmin-integration-")
        cls.root = Path(cls.tmp.name)
        cls.app = cls.root / "api"
        cls.app.mkdir()
        for name in ("app.py", "storage.py", "domain.py", "energy_renewal.py", "backup_lock.py"):
            shutil.copy2(API / name, cls.app / name)
        cls.data = cls.app / "data"
        cls.port = free_port()
        env = os.environ.copy()
        env.update({
            "APP_ENV": "development",
            "PORT": str(cls.port),
            "WEB_DIR": str(cls.root / "empty-web"),
            "SQLITE_DB_PATH": str(cls.data / "lifeadmin.sqlite3"),
            "SESSION_SECRET": "synthetic-integration-test-session-secret-only",
            "ADMIN_EMAILS": "",
            "DEMO_PAYMENTS": "false",
        })
        env.pop("DATABASE_URL", None)
        env.pop("STRIPE_SECRET_KEY", None)
        env.pop("OPENAI_API_KEY", None)
        cls.process = subprocess.Popen(
            [sys.executable, str(cls.app / "app.py")],
            cwd=cls.app,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        for _ in range(100):
            if cls.process.poll() is not None:
                stderr = cls.process.stderr.read().decode("utf-8", "replace")
                cls.tearDownClass()
                raise RuntimeError("Disposable API failed to start: " + stderr[:1000])
            try:
                if cls.request("/api/health")[0] == 200:
                    break
            except (URLError, TimeoutError):
                time.sleep(0.05)
        else:
            cls.tearDownClass()
            raise RuntimeError("Disposable API did not become healthy")

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "process") and cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait(timeout=5)
        if hasattr(cls, "process") and cls.process.stderr:
            cls.process.stderr.close()
        if hasattr(cls, "tmp"):
            cls.tmp.cleanup()

    @classmethod
    def request(cls, path, payload=None, headers=None):
        data = json.dumps(payload).encode() if payload is not None else None
        request = Request(
            f"http://127.0.0.1:{cls.port}{path}",
            data=data,
            headers={"Content-Type": "application/json", **(headers or {})},
            method="POST" if payload is not None else "GET",
        )
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read()), response.headers

    def test_health_during_exclusive_backup_lock(self):
        with data_lock(self.data, exclusive=True, timeout=1):
            status, body, _ = self.request("/api/health")
            self.assertEqual(status, 200)
            self.assertEqual(body["status"], "ok")

    def test_api_reads_and_writes_rejected_during_backup(self):
        with data_lock(self.data, exclusive=True, timeout=1):
            for path, payload in [
                ("/api/tasks", None),
                ("/api/auth/register", {"email": "blocked@example.invalid", "password": "syntheticPassword123"}),
                ("/api/stripe/webhook", {}),
            ]:
                status, body, headers = self.request(path, payload)
                self.assertEqual(status, 503, path)
                self.assertEqual(headers.get("Retry-After"), "2")
                self.assertIn("maintenance", body["error"].lower())
        status, body, _ = self.request("/api/tasks")
        self.assertEqual(status, 200)
        self.assertIn("tasks", body)

    def test_registration_and_backup_after_release(self):
        status, body, _ = self.request(
            "/api/auth/register",
            {"email": "synthetic@example.invalid", "password": "syntheticPassword123"},
        )
        self.assertEqual(status, 201, body)
        target = self.root / "backup"
        backup_data(self.data, target)
        with sqlite3.connect(target / "lifeadmin.sqlite3") as db:
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            count = db.execute(
                "SELECT count(*) FROM adminpilot_users WHERE email=?",
                ("synthetic@example.invalid",),
            ).fetchone()[0]
        self.assertEqual(count, 1)
        self.assertTrue((target / "manifest.json").is_file())


if __name__ == "__main__":
    unittest.main()
