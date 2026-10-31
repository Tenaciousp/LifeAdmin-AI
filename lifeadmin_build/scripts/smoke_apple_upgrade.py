"""Two-source-build upgrade acceptance on a disposable Apple simulator.

The baseline creates and acknowledges records and exports through native UI.
The candidate replaces the installed app without uninstalling or reseeding.
This tests schema-1 development builds, not signed App Store delivery.
"""
import argparse
from contextlib import chdir
import hashlib
import json
from pathlib import Path
import plistlib
import subprocess

from smoke_apple_simulator import (
    restart_simulator, run_ui_test, select_ios_runtime, select_simulator_type, sim,
    verify_device_records, verify_export_staging_removed,
)

BASELINE = "3149925df7f9ed74da651214fd43e695b3a08238"
BUNDLE = "uk.co.tenaciouspl.lifeadmin"


def package_identity(app):
    info = plistlib.loads((app / "Info.plist").read_bytes())
    if info["CFBundleIdentifier"] != BUNDLE:
        raise RuntimeError("Unexpected upgrade application identity")
    if not (app / "public").is_dir() or not (app / info["CFBundleExecutable"]).is_file():
        raise RuntimeError("Upgrade application code or assets are missing")
    # Compare shipped executable and customer assets, not test-runner metadata.
    files = [app / info["CFBundleExecutable"], *sorted((app / "public").rglob("*"))]
    digest = hashlib.sha256()
    for path in files:
        if path.is_file():
            digest.update(path.relative_to(app).as_posix().encode() + b"\0")
            digest.update(hashlib.sha256(path.read_bytes()).digest())
    return {"bundle": BUNDLE, "code_and_assets_sha256": digest.hexdigest(),
            "bundle_version": info["CFBundleVersion"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-native", type=Path, required=True)
    parser.add_argument("--device-family", choices=("iphone", "ipad"), required=True)
    args = parser.parse_args()
    baseline = args.baseline_native.resolve()
    source = subprocess.check_output(["git", "-C", str(baseline), "rev-parse", "HEAD"], text=True).strip()
    if source != BASELINE:
        raise RuntimeError("Upgrade baseline does not match the pinned source")
    candidate_source = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    evidence = Path("apple-launch-evidence").resolve()
    evidence.mkdir(exist_ok=True)
    app = Path("build-ios-simulator/Build/Products/Debug-iphonesimulator/App.app").resolve()
    candidate = package_identity(app)
    runtime = select_ios_runtime(json.loads(sim("list", "runtimes", "--json"))["runtimes"])
    selected = select_simulator_type(
        json.loads(sim("list", "devicetypes", "--json"))["devicetypes"], runtime, args.device_family)
    device = sim("create", "LifeAdmin CI upgrade", selected["identifier"], runtime["identifier"])
    cases = [
        ("testPrepareRecordsForAppUpgrade", "baseline", baseline),
        ("testUpgradedAppReopensAndSavesOriginalRecords", "candidate-saves", Path.cwd()),
        ("testMessageEditingCancelSaveAndRestart", "candidate-backup", Path.cwd()),
    ]
    try:
        sim("boot", device)
        sim("bootstatus", device, "-b", timeout=300)
        if args.device_family == "ipad":
            # On iPad the first XCTest runner has stalled during simulator
            # first-boot migration. Complete a clean boot cycle before the
            # baseline test, without changing or reseeding any app records.
            restart_simulator(device)
        method, label, root = cases[0]
        with chdir(root):
            run_ui_test(device, evidence, method, label + ".log", str(evidence / (label + ".xcresult")))
        older_app = baseline / "build-ios-simulator/Build/Products/Debug-iphonesimulator/App.app"
        older = package_identity(older_app)
        if older["code_and_assets_sha256"] == candidate["code_and_assets_sha256"]:
            raise RuntimeError("Upgrade requires different application code or assets")
        installed = Path(sim("get_app_container", device, BUNDLE, "app"))
        if package_identity(installed) != older:
            raise RuntimeError("Older application was not installed")
        container = Path(sim("get_app_container", device, BUNDLE, "data"))
        device_data = next(parent for parent in container.parents if parent.name == "data")
        exports = [path for path in device_data.rglob("lifeadmin-backup.json")
                   if path.is_file() and "lifeadmin-export-" not in str(path)]
        if len(exports) != 1:
            raise RuntimeError("Expected one older-build native export")
        backup = exports[0]
        original_export = backup.read_bytes()
        report = verify_device_records(device, BUNDLE, backup)
        (evidence / "baseline-backup.json").write_bytes(original_export)
        verify_export_staging_removed(device, BUNDLE)

        # No uninstall, data writes or host seeding between these installations.
        sim("install", device, str(app), timeout=120)
        installed = Path(sim("get_app_container", device, BUNDLE, "app"))
        if package_identity(installed) != candidate:
            raise RuntimeError("Candidate application was not installed")
        verify_device_records(device, BUNDLE, backup)
        for method, label, root in cases[1:]:
            if args.device_family == "ipad":
                restart_simulator(device)
                verify_device_records(device, BUNDLE, backup)
            run_ui_test(device, evidence, method, label + ".log", str(evidence / (label + ".xcresult")))
            verify_device_records(device, BUNDLE, backup)
        if backup.read_bytes() != original_export:
            raise RuntimeError("Older-build backup was overwritten")
        verify_export_staging_removed(device, BUNDLE)
        report.update({
            "baseline_source": source, "candidate_source": candidate_source,
            "baseline_package": older, "candidate_package": candidate,
            "runtime": runtime["version"], "device": selected["name"],
            "device_family": args.device_family,
            "upgrade_without_uninstall_passed": True,
            "native_saves_after_upgrade_passed": True,
            "older_backup_restore_after_upgrade_passed": True,
            "scope": "Different schema-1 development builds; simulator installation, not signed store delivery",
        })
        (evidence / "upgrade.json").write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report, indent=2), flush=True)
    finally:
        if not (evidence / "upgrade.json").exists():
            # Preserve app/WebKit startup evidence before deleting the disposable
            # simulator. Do not retry a failed launch or change its time limit.
            try:
                with (evidence / "upgrade-startup-system.log").open("w") as log:
                    subprocess.run([
                        "xcrun", "simctl", "spawn", device, "log", "show",
                        "--last", "5m", "--style", "compact", "--predicate",
                        'process == "App" OR process CONTAINS "WebKit"',
                    ], stdout=log, stderr=subprocess.STDOUT, check=False, timeout=30)
            except (OSError, subprocess.TimeoutExpired) as error:
                print("Upgrade startup log collection failed: " + str(error), flush=True)
        for _, label, _ in cases:
            log = evidence / (label + ".log")
            if log.exists():
                print(label + " diagnostics:\n" + log.read_text(errors="replace")[-12000:], flush=True)
            result = evidence / (label + ".xcresult")
            if result.is_dir():
                try:
                    subprocess.run([
                        "xcrun", "xcresulttool", "export", "attachments", "--path", str(result),
                        "--output-path", str(evidence / (label + "-attachments")),
                    ], check=False, timeout=60)
                except (OSError, subprocess.TimeoutExpired) as error:
                    print("Upgrade attachment collection failed: " + str(error), flush=True)
        subprocess.run(["xcrun", "simctl", "shutdown", device], check=False, timeout=60)
        subprocess.run(["xcrun", "simctl", "delete", device], check=False, timeout=60)


if __name__ == "__main__":
    main()
