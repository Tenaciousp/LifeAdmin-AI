"""Capture native store previews on disposable Apple simulators.

Only synthetic records are entered. Screenshot dimensions are checked here;
visual approval and final store acceptance remain separate.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess

from smoke_apple_simulator import run_ui_test, select_ios_runtime, sim
from smoke_apple_upgrade import BUNDLE, package_identity

TARGETS = {
    "iphone": ("iPhone 16 Pro", (1206, 2622)),
    "ipad": ("iPad Pro (12.9-inch) (6th generation)", (2048, 2732)),
}
SCENES = ("01 home", "02 plan", "03 message", "04 ai-review", "05 backups")


def extract_screenshots(attachments, output, size):
    manifest = json.loads((attachments / "manifest.json").read_text())
    entries = [entry for test in manifest for entry in test["attachments"]]
    screenshots = []
    for scene in SCENES:
        matches = [entry for entry in entries
                   if entry.get("suggestedHumanReadableName", "").startswith("Store " + scene + "_")
                   and entry.get("exportedFileName", "").endswith(".png")]
        if len(matches) != 1:
            raise RuntimeError("Expected one native screenshot for " + scene)
        data = (attachments / matches[0]["exportedFileName"]).read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n" or len(data) < 24:
            raise RuntimeError("Invalid screenshot PNG for " + scene)
        dimensions = struct.unpack(">II", data[16:24])
        if dimensions != size:
            raise RuntimeError(f"Wrong screenshot size for {scene}: {dimensions}, expected {size}")
        screenshots.append((scene.replace(" ", "-", 1) + ".png", data))
    # Validate the complete set before exposing any delivery images.
    output.mkdir(parents=True, exist_ok=True)
    result = []
    for name, data in screenshots:
        (output / name).write_bytes(data)
        result.append({"file": name, "width": size[0], "height": size[1],
                       "sha256": hashlib.sha256(data).hexdigest()})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device-family", choices=TARGETS, required=True)
    args = parser.parse_args()
    name, size = TARGETS[args.device_family]
    app = Path("build-ios-simulator/Build/Products/Debug-iphonesimulator/App.app")
    identity = package_identity(app)
    evidence = Path("apple-launch-evidence")
    evidence.mkdir(exist_ok=True)
    runtime = select_ios_runtime(json.loads(sim("list", "runtimes", "--json"))["runtimes"])
    types = json.loads(sim("list", "devicetypes", "--json"))["devicetypes"]
    matches = [device for device in types if device["name"] == name]
    if len(matches) != 1:
        raise RuntimeError("Required store screenshot device is unavailable: " + name)
    device = sim("create", "LifeAdmin store previews", matches[0]["identifier"], runtime["identifier"])
    result = evidence / "store-screenshots.xcresult"
    attachments = evidence / "store-attachments"
    try:
        sim("boot", device)
        sim("bootstatus", device, "-b", timeout=300)
        sim("status_bar", device, "override", "--time", "9:41",
            "--batteryState", "charged", "--batteryLevel", "100")
        sim("install", device, str(app.resolve()), timeout=120)
        run_ui_test(device, evidence, "testStoreScreenshots",
                    "store-screenshots.log", str(result))
    finally:
        if result.is_dir():
            try:
                subprocess.run(["xcrun", "xcresulttool", "export", "attachments",
                                "--path", str(result), "--output-path", str(attachments)],
                               check=True, timeout=90)
            finally:
                sim("shutdown", device)
                sim("delete", device)
        else:
            sim("shutdown", device)
            sim("delete", device)
    output = Path("store-screenshots")
    images = extract_screenshots(attachments, output, size)
    (output / "manifest.json").write_text(json.dumps({
        "source_commit": os.environ.get("GITHUB_SHA"),
        "device": name, "runtime": runtime["version"],
        "package": identity, "images": images,
        "scope": "Native simulator captures with invented records; visual review required before store upload",
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
