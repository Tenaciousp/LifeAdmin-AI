import subprocess
from pathlib import Path
import unittest

class NativeRepositoryTests(unittest.TestCase):
    def test_native_repository_contract(self):
        module = Path(__file__).resolve().parents[2] / "adminpilot-ai/src/lib/offline/native-store.test.mjs"
        result = subprocess.run(["node", "--test", str(module)], capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

if __name__ == "__main__":
    unittest.main()
