"""Launch the compiled customer app in a disposable CI iPhone simulator.

Screenshots require human review. This is not household-data or device acceptance.
"""
import json
import sqlite3
from contextlib import closing
from pathlib import Path
import subprocess
import sys
import time


def sim(*args, timeout=60):
    started = time.monotonic()
    command = ["xcrun", "simctl", *args]
    log = Path("apple-launch-evidence/commands.log")
    try:
        result = subprocess.run(
            command, check=True, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout,
        )
        with log.open("a") as handle:
            handle.write(f"{args[0]} completed in {time.monotonic() - started:.1f}s\n")
            handle.write(result.stdout + result.stderr + "\n")
        return result.stdout.strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        with log.open("a") as handle:
            handle.write(f"{args[0]} failed after {time.monotonic() - started:.1f}s: {error}\n")
            for output in (error.stdout, error.stderr):
                if output:
                    handle.write(output.decode(errors="replace") if isinstance(output, bytes) else output)
        raise



def run_ui_test(device, evidence, method, log_name, result_path):
    with (evidence / log_name).open("w") as log:
        subprocess.run([
            "xcodebuild", "-project", "ios/App/App.xcodeproj",
            "-scheme", "LifeAdminAcceptance", "-configuration", "Debug",
            "-destination", "platform=iOS Simulator,id=" + device,
            "-derivedDataPath", "build-ios-simulator",
            "-resultBundlePath", result_path,
            "-parallel-testing-enabled", "NO",
            "-test-timeouts-enabled", "YES",
            "-default-test-execution-time-allowance", "900",
            "-maximum-test-execution-time-allowance", "900",
            "-only-testing:LifeAdminUITests/LifeAdminUITests/" + method,
            "CODE_SIGNING_ALLOWED=NO", "test",
        ], check=True, stdout=log, stderr=subprocess.STDOUT, timeout=1200)


def create_invalid_backups(export_path):
    original = json.loads(export_path.read_text())
    folder = export_path.parent
    (folder / "ci-malformed.json").write_text("{broken")
    (folder / "ci-future.json").write_text(json.dumps({**original, "version": 2}))
    invalid_plan = json.loads(export_path.read_text())
    invalid_plan["plans"][0]["missing_details"] = "Invalid list"
    (folder / "ci-invalid-plan.json").write_text(json.dumps(invalid_plan))
    (folder / "ci-oversized.json").write_bytes(b"x" * (5 * 1024 * 1024 + 1))


def verify_exported_records(backup_path, database_path):
    exported = json.loads(backup_path.read_text())
    with closing(sqlite3.connect(database_path.as_uri() + "?mode=ro", uri=True)) as connection:
        row = connection.execute("SELECT data FROM snapshot WHERE id=1").fetchone()
    if row is None:
        raise RuntimeError("Restored native snapshot is missing")
    restored = json.loads(row[0])
    for snapshot in (exported, restored):
        if snapshot.get("format") != "lifeadmin-backup" or snapshot.get("version") != 1:
            raise RuntimeError("Unexpected native backup format")
    if any(exported[key] != restored[key] for key in ("tasks", "plans")):
        raise RuntimeError("Restored records differ from the exported backup")
    if len(exported["tasks"]) != 1 or len(exported["plans"]) != 1:
        raise RuntimeError("Expected one synthetic bill and plan after replacement")
    task = exported["tasks"][0]
    if (task.get("notes") != "Note7319" or
            task.get("details", {}).get("account_reference") != "REF-7319" or
            task.get("details", {}).get("provider") != "Netflix"):
        raise RuntimeError("Synthetic bill details were not preserved")
    return {"exact_record_match": True, "tasks": 1, "plans": 1,
            "synthetic_details_preserved": True, "scope": "Disposable CI simulator only"}

def verify_device_records(device, bundle, backup_path):
    # XCTest installs can move the app data container between test commands.
    container = Path(sim("get_app_container", device, bundle, "data"))
    return verify_exported_records(
        backup_path, container / "Library/Application Support/LifeAdmin/records-v1.sqlite")


def verify_export_staging_removed(device, bundle):
    container = Path(sim("get_app_container", device, bundle, "data"))
    temporary = container / "tmp"
    if not temporary.is_dir():
        raise RuntimeError("Native temporary directory is unavailable for inspection")
    if any(temporary.glob("lifeadmin-export-*")):
        raise RuntimeError("Interrupted export left a private staging copy after restart")


def configure_write_failure(device, bundle, enabled):
    # Disposable simulator only. A trigger aborts the real INSERT statement;
    # no test bypass or failure switch is added to the shipped native plugin.
    container = Path(sim("get_app_container", device, bundle, "data"))
    database = container / "Library/Application Support/LifeAdmin/records-v1.sqlite"
    with closing(sqlite3.connect(database.as_uri() + "?mode=rw", uri=True)) as connection, connection:
        if enabled:
            connection.execute("CREATE TRIGGER ci_reject_snapshot AFTER INSERT ON snapshot "
                               "BEGIN SELECT RAISE(ABORT, 'Synthetic CI write rejection'); END")
        else:
            connection.execute("DROP TRIGGER IF EXISTS ci_reject_snapshot")


def main():
    app = Path("build-ios-simulator/Build/Products/Debug-iphonesimulator/App.app")
    if not app.is_dir():
        raise RuntimeError("Compiled simulator app missing")
    evidence = Path("apple-launch-evidence")
    evidence.mkdir(exist_ok=True)
    runtimes = json.loads(sim("list", "runtimes", "--json"))["runtimes"]
    runtimes = [r for r in runtimes if r.get("isAvailable") and 
                r["identifier"].startswith("com.apple.CoreSimulator.SimRuntime.iOS-")]
    if not runtimes:
        raise RuntimeError("No available iOS simulator runtime")
    runtime = max(runtimes, key=lambda r: tuple(map(int, r["version"].split("."))))
    types = json.loads(sim("list", "devicetypes", "--json"))["devicetypes"]
    parts = [int(n) for n in runtime["version"].split(".")]
    parts = (parts + [0, 0])[:3]
    version = (parts[0] << 16) | (parts[1] << 8) | parts[2]
    phones = [d for d in types if d["name"].startswith("iPhone") and
              d.get("minRuntimeVersion", 0) <= version <= d.get("maxRuntimeVersion", 0xffffffff)]
    if not phones:
        raise RuntimeError("No compatible iPhone simulator type")
    device = sim("create", "LifeAdmin CI smoke", phones[-1]["identifier"], runtime["identifier"])
    bundle = "uk.co.tenaciouspl.lifeadmin"
    try:
        sim("boot", device)
        sim("bootstatus", device, "-b", timeout=300)
        sim("install", device, str(app.resolve()), timeout=120)
        # Let XCTest own the initial launch so a simctl launch timeout does not
        # prevent collection of UI-test diagnostics. Both checks must still pass.
        if "--ui-tests" in sys.argv:
            print("Starting Apple interactive acceptance on a fresh installation.", flush=True)
            run_ui_test(device, evidence,
                        "testNativeBackupRoundTripAndCancellationPreserveRecords",
                        "ui-tests.log", "apple-ui-tests.xcresult")
            container = Path(sim("get_app_container", device, bundle, "data"))
            device_data = next(parent for parent in container.parents if parent.name == "data")
            exports = [path for path in device_data.rglob("lifeadmin-backup.json")
                       if path.is_file() and "lifeadmin-export-" not in str(path)]
            if len(exports) != 1:
                raise RuntimeError(f"Expected one exported JSON document, found {len(exports)}")
            verification = verify_device_records(device, bundle, exports[0])
            (evidence / "backup-round-trip.json").write_text(json.dumps(verification, indent=2) + "\n")
            print("Complete exported/restored native records match.", flush=True)
            run_ui_test(device, evidence, "testInterruptedBackupPickersPreserveRecords",
                        "interrupted-picker-ui-tests.log",
                        str(evidence / "interrupted-pickers.xcresult"))
            verify_device_records(device, bundle, exports[0])
            verify_export_staging_removed(device, bundle)
            verification["export_staging_cleanup_passed"] = True
            verification["interrupted_picker_checks_passed"] = True
            (evidence / "backup-round-trip.json").write_text(json.dumps(verification, indent=2) + "\n")
            create_invalid_backups(exports[0])
            run_ui_test(device, evidence, "testNativeBackupRejectsInvalidFiles",
                        "invalid-backup-ui-tests.log",
                        str(evidence / "invalid-backups.xcresult"))
            verification = verify_device_records(device, bundle, exports[0])
            verify_export_staging_removed(device, bundle)
            verification["export_staging_cleanup_passed"] = True
            verification["interrupted_picker_checks_passed"] = True
            verification["invalid_file_checks_passed"] = True
            (evidence / "backup-round-trip.json").write_text(json.dumps(verification, indent=2) + "\n")
            print("Native invalid-file rejection preserved the complete saved records.", flush=True)
            # Install over the populated app without uninstalling. This checks
            # same-build replacement, not cross-version schema migration.
            sim("install", device, str(app.resolve()), timeout=120)
            sim("launch", device, bundle, timeout=120)
            time.sleep(10)
            sim("io", device, "screenshot", str(evidence / "package-reinstall.png"))
            sim("terminate", device, bundle)
            verify_device_records(device, bundle, exports[0])
            recovery = {"package_reinstall_preserved_records": True,
                        "scope": "Disposable CI simulator; same-build reinstall and injected SQL rejection only"}
            (evidence / "storage-recovery.json").write_text(json.dumps(recovery, indent=2) + "\n")
            configure_write_failure(device, bundle, True)
            try:
                run_ui_test(device, evidence, "testRejectedNativeWritePreservesRecords",
                            "rejected-write-ui-tests.log", str(evidence / "rejected-write.xcresult"))
                verify_device_records(device, bundle, exports[0])
                recovery["rejected_write_preserved_records"] = True
            finally:
                configure_write_failure(device, bundle, False)
            run_ui_test(device, evidence, "testNativeWriteRecoversAfterRejection",
                        "write-recovery-ui-tests.log", str(evidence / "write-recovery.xcresult"))
            verify_device_records(device, bundle, exports[0])
            recovery["successful_writes_after_rejection"] = True
            (evidence / "storage-recovery.json").write_text(json.dumps(recovery, indent=2) + "\n")
            print("Native rejected-write recovery and package reinstallation preserved exact records.")
            print("Apple interactive persistence and deletion test passed.")
        results = []
        labels = ("post-ui-launch", "relaunch") if "--ui-tests" in sys.argv else ("first-launch", "relaunch")
        for label in labels:
            launched = sim("launch", device, bundle, timeout=120)
            results.append({"stage": label, "launch": launched})
            time.sleep(10)
            sim("io", device, "screenshot", str(evidence / (label + ".png")))
            # Termination fails if the app already crashed or exited.
            sim("terminate", device, bundle)
        (evidence / "result.json").write_text(json.dumps({
            "runtime": runtime["version"], "device": phones[-1]["name"],
            "interactive_acceptance_passed": "--ui-tests" in sys.argv,
            "launches": results, "scope": "Simulator only; physical-device acceptance outstanding",
        }, indent=2) + "\n")
        print("Apple simulator launch and relaunch completed; review screenshots.")
    except Exception:
        for filename in ("ui-tests.log", "interrupted-picker-ui-tests.log", "invalid-backup-ui-tests.log",
                         "rejected-write-ui-tests.log", "write-recovery-ui-tests.log"):
            ui_log = evidence / filename
            if ui_log.exists():
                diagnostics = ui_log.read_text(errors="replace")
                failures = [line for line in diagnostics.splitlines()
                            if ": error:" in line or "failed -" in line]
                print(filename + " failure assertions:\n" + "\n".join(failures), flush=True)
                print("Final UI-test diagnostics:\n" + diagnostics[-20000:], flush=True)
        # Preserve synthetic simulator evidence before removing the disposable device.
        diagnostics = [
            ("failure-screen.log", ["io", device, "screenshot", str(evidence / "failure.png")]),
            ("failure-system.log", ["spawn", device, "log", "show", "--last", "2m",
             "--style", "compact", "--predicate",
             'process == "App" OR process == "SpringBoard" OR process == "runningboardd" OR process == "launchd"']),
        ]
        for filename, arguments in diagnostics:
            try:
                with (evidence / filename).open("w") as log:
                    subprocess.run(["xcrun", "simctl", *arguments], stdout=log,
                                   stderr=subprocess.STDOUT, timeout=20, check=False)
            except (OSError, subprocess.TimeoutExpired):
                pass
        raise
    finally:
        # The broad two-minute failure log can start after file selection.
        # Preserve fixed-message native stages across the complete UI journey.
        trace_path = evidence / "native-file-events.log"
        try:
            with trace_path.open("w") as trace:
                subprocess.run([
                    "xcrun", "simctl", "spawn", device, "log", "show",
                    "--last", "30m", "--style", "compact", "--predicate",
                    'eventMessage CONTAINS "LifeAdminFiles:"',
                ], stdout=trace, stderr=subprocess.STDOUT, timeout=30, check=False)
            print("Native file-stage diagnostics:\n" +
                  trace_path.read_text(errors="replace")[-12000:], flush=True)
        except (OSError, subprocess.TimeoutExpired) as error:
            print("Native file-stage collection failed: " + str(error), flush=True)
        # Export XCTest's in-app screenshots before cleanup. The outer failure
        # screenshot is taken after tearDown and often shows the home screen.
        for bundle, directory, filename in (
            ("apple-ui-tests.xcresult", "ui-attachments", "attachment-export.log"),
            (str(evidence / "interrupted-pickers.xcresult"), "interrupted-picker-attachments",
             "interrupted-picker-attachment-export.log"),
            (str(evidence / "invalid-backups.xcresult"), "invalid-backup-attachments",
             "invalid-backup-attachment-export.log"),
            (str(evidence / "rejected-write.xcresult"), "rejected-write-attachments",
             "rejected-write-attachment-export.log"),
            (str(evidence / "write-recovery.xcresult"), "write-recovery-attachments",
             "write-recovery-attachment-export.log"),
        ):
            if Path(bundle).is_dir():
                try:
                    with (evidence / filename).open("w") as log:
                        subprocess.run([
                            "xcrun", "xcresulttool", "export", "attachments",
                            "--path", bundle, "--output-path", str(evidence / directory),
                        ], stdout=log, stderr=subprocess.STDOUT, timeout=60, check=False)
                except (OSError, subprocess.TimeoutExpired) as error:
                    print("XCTest attachment export failed: " + str(error), flush=True)
        subprocess.run(["xcrun", "simctl", "shutdown", device], check=False, timeout=60)
        subprocess.run(["xcrun", "simctl", "delete", device], check=False, timeout=60)


if __name__ == "__main__":
    main()


