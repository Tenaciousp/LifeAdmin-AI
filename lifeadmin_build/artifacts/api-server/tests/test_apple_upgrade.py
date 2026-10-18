"""Upgrade identity must distinguish real customer code and asset changes."""
import importlib.util
from pathlib import Path
import plistlib
import sys
import tempfile
import unittest

scripts = Path(__file__).resolve().parents[3] / "scripts"
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location("apple_upgrade", scripts / "smoke_apple_upgrade.py")
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)


class UpgradePackageTests(unittest.TestCase):
    def test_code_and_assets_change_identity_but_file_order_does_not(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            info = {"CFBundleIdentifier": upgrade.BUNDLE,
                    "CFBundleExecutable": "App", "CFBundleVersion": "1"}
            (app / "Info.plist").write_bytes(plistlib.dumps(info))
            (app / "App").write_bytes(b"older executable")
            public = app / "public"
            public.mkdir()
            (public / "index.html").write_text("Older customer page")
            (public / "local.js").write_text("Older planner")
            older = upgrade.package_identity(app)
            (public / "index.html").unlink()
            (public / "index.html").write_text("Older customer page")
            self.assertEqual(upgrade.package_identity(app), older)
            (public / "local.js").write_text("New customer feature")
            self.assertNotEqual(upgrade.package_identity(app), older)
            (public / "local.js").write_text("Older planner")
            (app / "App").write_bytes(b"newer executable")
            self.assertNotEqual(upgrade.package_identity(app), older)
            (app / "App").unlink()
            with self.assertRaisesRegex(RuntimeError, "missing"):
                upgrade.package_identity(app)
            info["CFBundleIdentifier"] = "another.application"
            (app / "Info.plist").write_bytes(plistlib.dumps(info))
            with self.assertRaisesRegex(RuntimeError, "identity"):
                upgrade.package_identity(app)
