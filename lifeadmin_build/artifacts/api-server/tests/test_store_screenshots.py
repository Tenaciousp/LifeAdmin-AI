"""Store previews must be complete native PNG sets at the requested dimensions."""
import base64
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

scripts = Path(__file__).resolve().parents[3] / "scripts"
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location("store_capture", scripts / "capture_store_screenshots.py")
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


class StoreCaptureTests(unittest.TestCase):
    def test_complete_set_is_copied_and_incomplete_or_wrong_size_sets_are_rejected(self):
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            attachments = root / "attachments"
            attachments.mkdir()
            entries = []
            for index, scene in enumerate(capture.SCENES):
                name = f"{index}.png"
                (attachments / name).write_bytes(png)
                entries.append({"exportedFileName": name,
                                "suggestedHumanReadableName": "Store " + scene + "_0_sample.png"})
            manifest = attachments / "manifest.json"
            manifest.write_text(json.dumps([{"attachments": entries}]))
            output = root / "previews"
            result = capture.extract_screenshots(attachments, output, (1, 1))
            self.assertEqual([item["file"] for item in result],
                             [scene.replace(" ", "-", 1) + ".png" for scene in capture.SCENES])
            for item in result:
                self.assertEqual((output / item["file"]).read_bytes(), png)
            with self.assertRaisesRegex(RuntimeError, "Wrong screenshot size"):
                capture.extract_screenshots(attachments, root / "wrong-size", (1206, 2622))
            self.assertFalse((root / "wrong-size").exists())
            manifest.write_text(json.dumps([{"attachments": entries[:-1]}]))
            with self.assertRaisesRegex(RuntimeError, "Expected one native screenshot"):
                capture.extract_screenshots(attachments, root / "incomplete", (1, 1))
            self.assertFalse((root / "incomplete").exists())
