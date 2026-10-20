"""Run local repository integration tests against an IndexedDB implementation."""
from pathlib import Path
import subprocess
import unittest


class OfflineStorageTests(unittest.TestCase):
    def test_transactional_device_repository(self):
        target = Path(__file__).resolve().parents[2] / "adminpilot-ai/src/lib/offline/storage.test.mjs"
        result = subprocess.run(
            ["node", "--test", str(target)], capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
