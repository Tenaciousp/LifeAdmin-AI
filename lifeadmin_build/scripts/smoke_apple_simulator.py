"""Launch the compiled customer app in a disposable CI Apple simulator.

Screenshots require human review. This is not household-data or device acceptance.
"""
import argparse
import json
import selectors
import signal
import sqlite3
from contextlib import closing, nullcontext
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
    from capture_apple_network import capture_snapshot

    capture_snapshot(evidence, "before:" + method)
    try:
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
    finally:
        capture_snapshot(evidence, "after:" + method)


def restart_simulator(device):
    # Restart the disposable OS without deleting app data or retrying a test.
    # This clears keyboard/runner state left across UI test sessions.
    sim("shutdown", device, timeout=120)
    sim("boot", device)
    sim("bootstatus", device, "-b", timeout=300)


def create_invalid_backups(export_path):
    original = json.loads(export_path.read_text())
    folder = export_path.parent
    (folder / "ci-malformed.json").write_text("{broken")
    (folder / "ci-future.json").write_text(json.dumps({**original, "version": 2}))
    invalid_plan = json.loads(export_path.read_text())
    invalid_plan["plans"][0]["missing_details"] = "Invalid list"
    (folder / "ci-invalid-plan.json").write_text(json.dumps(invalid_plan))
    for kind in ("tasks", "plans"):
        duplicate = json.loads(export_path.read_text())
        duplicate[kind].append(duplicate[kind][0].copy())
        (folder / f"ci-duplicate-{kind}.json").write_text(json.dumps(duplicate))
    orphan = json.loads(export_path.read_text())
    orphan["plans"][0]["task_id"] = "ci-missing-bill"
    (folder / "ci-orphan-plan.json").write_text(json.dumps(orphan))
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


def configure_storage_version(device, bundle, version):
    # Only synthetic supported/future versions on the disposable CI database.
    if version not in (1, 2):
        raise ValueError("Unexpected test storage version")
    container = Path(sim("get_app_container", device, bundle, "data"))
    database = container / "Library/Application Support/LifeAdmin/records-v1.sqlite"
    with closing(sqlite3.connect(database.as_uri() + "?mode=rw", uri=True)) as connection, connection:
        previous = connection.execute("PRAGMA user_version").fetchone()[0]
        if previous not in (1, 2):
            raise RuntimeError("Unexpected existing test storage version")
        connection.execute(f"PRAGMA user_version={version}")
        return previous


def interrupt_snapshot_transaction(device, bundle):
    # Host-side writer on a stopped disposable app's synthetic database only.
    # Force dirty pages out of a small cache so native reopening must recover
    # a real hot rollback journal, not merely discard an in-memory UPDATE.
    container = Path(sim("get_app_container", device, bundle, "data"))
    database = container / "Library/Application Support/LifeAdmin/records-v1.sqlite"
    script = """
import json, sqlite3, sys
from pathlib import Path
database = Path(sys.argv[1])
db = sqlite3.connect(database.as_uri() + "?mode=rw", uri=True)
assert db.execute("PRAGMA user_version").fetchone()[0] == 1
assert db.execute("PRAGMA journal_mode=DELETE").fetchone()[0] == "delete"
db.execute("PRAGMA synchronous=FULL")
db.execute("PRAGMA cache_size=5")
db.execute("PRAGMA cache_spill=ON")
db.execute("BEGIN IMMEDIATE")
row = db.execute("SELECT data FROM snapshot WHERE id=1").fetchone()
assert row is not None
changed = json.loads(row[0])
assert len(changed["tasks"]) == len(changed["plans"]) == 1
changed["tasks"][0]["notes"] = "UNCOMMITTED CI WRITE " + "x" * (2 * 1024 * 1024)
db.execute("INSERT OR REPLACE INTO snapshot (id, revision, data) VALUES (1, ?, ?)",
           ("ci-uncommitted", json.dumps(changed)))
assert db.execute("SELECT revision FROM snapshot WHERE id=1").fetchone()[0] == "ci-uncommitted"
journal = Path(str(database) + "-journal")
assert journal.read_bytes()[:8] == bytes.fromhex("d9d505f920a163d7")
print("HOT JOURNAL READY", flush=True)
sys.stdin.read(1)  # Parent kills this process without COMMIT or close/rollback.
raise RuntimeError("Interrupted writer unexpectedly resumed")
"""
    with subprocess.Popen([sys.executable, "-c", script, str(database)],
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, text=True) as writer:
        try:
            with selectors.DefaultSelector() as ready:
                ready.register(writer.stdout, selectors.EVENT_READ)
                if not ready.select(timeout=20):
                    raise RuntimeError("Interrupted writer did not reach the journal barrier")
            if writer.stdout.readline().strip() != "HOT JOURNAL READY":
                raise RuntimeError("Interrupted writer failed before the journal barrier")
            writer.kill()
            writer.communicate(timeout=10)
            if writer.returncode != -signal.SIGKILL:
                raise RuntimeError("Interrupted writer was not killed without cleanup")
        finally:
            if writer.poll() is None:
                writer.kill()
                writer.communicate(timeout=10)
    journal = Path(str(database) + "-journal")
    if journal.read_bytes()[:8] != bytes.fromhex("d9d505f920a163d7"):
        raise RuntimeError("Interrupted transaction did not retain a hot rollback journal")
    return {"hot_journal_before_native_launch": True, "writer_sigkill_confirmed": True,
            "scope": "Host-injected uncommitted SQLite transaction on disposable simulator; not native-process interruption or power loss"}


def generate_accessibility_fixture():
    # Generate before booting the simulator so host Node does not compete with
    # cold iOS startup. Keep a bounded allowance for hosted-runner startup.
    script = """
import { generateAndSaveLocalPlan } from "../artifacts/adminpilot-ai/src/lib/offline/plans.mjs";
import { serialise, parseBackup } from "../artifacts/adminpilot-ai/src/lib/offline/storage.mjs";
const task = {
  id: "ci-accessibility-bill", title: "CI sample subscription",
  category_id: "subscriptions_memberships", category: "Subscriptions and memberships",
  goal_id: "cancel_switch", status: "Open", notes: "Note7319",
  details: { provider: "Netflix", account_reference: "REF-7319" },
  created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z"
};
const snapshot = { tasks: [task], plans: [] };
await generateAndSaveLocalPlan({
  read: async () => structuredClone(snapshot),
  savePlan: async plan => { snapshot.plans.push(plan); }
}, task.id);
const text = serialise(snapshot);
parseBackup(text);
process.stdout.write(text);
"""
    started = time.monotonic()
    generated = subprocess.run(["node", "--input-type=module", "-e", script],
                               check=True, text=True, capture_output=True, timeout=120)
    print(f"Synthetic planner fixture generated in {time.monotonic() - started:.1f}s", flush=True)
    return generated.stdout


def prepare_accessibility_fixture(device, bundle, evidence, fixture_text=None):
    # Seed only the disposable, not-yet-launched simulator app. Use the real
    # planner and backup validator so accessibility sees a representative plan.
    if fixture_text is None:
        fixture_text = generate_accessibility_fixture()
    backup = evidence / "accessibility-fixture.json"
    # Parse before touching the native database, even if fixture generation fails.
    snapshot = json.loads(fixture_text)
    if snapshot.get("format") != "lifeadmin-backup" or snapshot.get("version") != 1:
        raise RuntimeError("Invalid generated accessibility fixture")
    container = Path(sim("get_app_container", device, bundle, "data"))
    database = container / "Library/Application Support/LifeAdmin/records-v1.sqlite"
    database.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database.as_uri() + "?mode=rwc", uri=True)) as connection, connection:
        if connection.execute("SELECT name FROM sqlite_master").fetchone() is not None:
            raise RuntimeError("Accessibility fixture requires an unused native database")
        connection.execute("CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL, data TEXT NOT NULL)")
        connection.execute("INSERT INTO snapshot VALUES (1, ?, ?)", ("ci-accessibility-fixture", fixture_text))
        connection.execute("PRAGMA user_version=1")
    backup.write_text(fixture_text)
    return backup


def select_ios_runtime(runtimes):
    # Keep simulator results reproducible. CI #369's automatically selected
    # iOS 26.5 WebKit networking process stalled before the audit could start.
    matches = [runtime for runtime in runtimes
               if runtime.get("isAvailable") and
               runtime.get("identifier", "").startswith("com.apple.CoreSimulator.SimRuntime.iOS-") and
               runtime.get("version") == "26.2"]
    if len(matches) != 1:
        raise RuntimeError("Exactly one available iOS 26.2 simulator runtime is required")
    return matches[0]


def select_simulator_type(types, runtime, family):
    parts = [int(n) for n in runtime["version"].split(".")]
    parts = (parts + [0, 0])[:3]
    version = (parts[0] << 16) | (parts[1] << 8) | parts[2]
    compatible = [d for d in types
                  if d["name"].startswith("iPhone" if family == "iphone" else "iPad") and
                  d.get("minRuntimeVersion", 0) <= version <= d.get("maxRuntimeVersion", 0xffffffff)]
    if family == "ipad":
        # Pin a representative tablet rather than silently changing screen size.
        compatible = [d for d in compatible if d["identifier"] ==
                      "com.apple.CoreSimulator.SimDeviceType.iPad-10th-generation"]
    if not compatible:
        raise RuntimeError(f"No compatible {family} simulator type")
    return compatible[-1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ui-tests", action="store_true")
    parser.add_argument("--device-family", choices=("iphone", "ipad"), default="iphone")
    args = parser.parse_args()
    app = Path("build-ios-simulator/Build/Products/Debug-iphonesimulator/App.app")
    if not app.is_dir():
        raise RuntimeError("Compiled simulator app missing")
    evidence = Path("apple-launch-evidence")
    evidence.mkdir(exist_ok=True)
    runtimes = json.loads(sim("list", "runtimes", "--json"))["runtimes"]
    runtime = select_ios_runtime(runtimes)
    types = json.loads(sim("list", "devicetypes", "--json"))["devicetypes"]
    selected = select_simulator_type(types, runtime, args.device_family)
    (evidence / "simulator-environment.json").write_text(json.dumps({
        "runtime": runtime["version"], "runtime_build": runtime["buildversion"],
        "device": selected["name"], "device_family": args.device_family,
        "scope": "Pinned disposable CI simulator",
    }, indent=2) + "\n")
    fixture_text = generate_accessibility_fixture() if args.ui_tests else None
    device = sim("create", "LifeAdmin CI smoke", selected["identifier"], runtime["identifier"])
    bundle = "uk.co.tenaciouspl.lifeadmin"
    try:
        sim("boot", device)
        sim("bootstatus", device, "-b", timeout=300)
        # First boot can still be finishing iOS data migration after bootstatus succeeds.
        sim("install", device, str(app.resolve()), timeout=300)
        from capture_apple_network import capture_network
        # Capture every app launch, but not simulator boot/install traffic.
        if args.ui_tests:
            with capture_network("preflight"):
                fixture = prepare_accessibility_fixture(device, bundle, evidence, fixture_text)
                run_ui_test(device, evidence, "testAppleAccessibilityAuditOnBillsAndPlan",
                            "accessibility-ui-tests.log", str(evidence / "accessibility.xcresult"))
                accessibility = verify_device_records(device, bundle, fixture)
                accessibility["sampled_screen_accessibility_audits_passed"] = True
                accessibility["scope"] = f"Synthetic seeded fixture on disposable {args.device_family} simulator; manual assistive-technology acceptance outstanding"
                (evidence / "accessibility.json").write_text(json.dumps(accessibility, indent=2) + "\n")
                # Reset after the audit; the backup journey must still start empty.
                sim("uninstall", device, bundle, timeout=120)
                sim("install", device, str(app.resolve()), timeout=120)
                if args.device_family == "ipad":
                    run_ui_test(device, evidence, "testKeyboardEntryAfterRepeatedRelaunch",
                                "keyboard-relaunch-ui-tests.log", str(evidence / "keyboard-relaunch.xcresult"))
            if args.device_family == "ipad":
                # Isolate the backup test from the prior keyboard/UI session.
                # This resets only the disposable OS, never acknowledged data.
                sim("uninstall", device, bundle, timeout=120)
                sim("install", device, str(app.resolve()), timeout=120)
                restart_simulator(device)
        with capture_network() if args.ui_tests else nullcontext():
            if args.ui_tests:
                print("Starting Apple interactive acceptance on a fresh installation.", flush=True)
                run_ui_test(device, evidence,
                            "testNativeBackupRoundTripAndCancellationPreserveRecords",
                            "ui-tests.log", "apple-ui-tests.xcresult")
                container = Path(sim("get_app_container", device, bundle, "data"))
                device_data = next(parent for parent in container.parents if parent.name == "data")
                exports = [path for path in device_data.rglob("homeadmin-backup.json")
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
                original_version = configure_storage_version(device, bundle, 2)
                try:
                    if original_version != 1:
                        raise RuntimeError("Expected supported storage version before future-version test")
                    run_ui_test(device, evidence, "testUnsupportedNativeStorageVersionBlocksWorkspace",
                                "unsupported-storage-ui-tests.log", str(evidence / "unsupported-storage.xcresult"))
                    verify_device_records(device, bundle, exports[0])
                finally:
                    preserved_version = configure_storage_version(device, bundle, original_version)
                if preserved_version != 2:
                    raise RuntimeError("App rewrote the unsupported storage version")
                run_ui_test(device, evidence, "testNativeStorageVersionRecoveryPreservesRecords",
                            "storage-version-recovery-ui-tests.log", str(evidence / "storage-version-recovery.xcresult"))
                verify_device_records(device, bundle, exports[0])
                recovery["unsupported_storage_version_preserved"] = True
                recovery["supported_storage_version_recovered"] = True
                (evidence / "storage-recovery.json").write_text(json.dumps(recovery, indent=2) + "\n")
                interrupted = interrupt_snapshot_transaction(device, bundle)
                (evidence / "interrupted-transaction.json").write_text(json.dumps(interrupted, indent=2) + "\n")
                # No host SQLite read between SIGKILL and native app launch: native
                # SQLite must be the first opener of the hot journal.
                run_ui_test(device, evidence, "testInterruptedSnapshotRecoveryPreservesRecords",
                            "interrupted-transaction-ui-tests.log", str(evidence / "interrupted-transaction.xcresult"))
                interrupted.update(verify_device_records(device, bundle, exports[0]))
                interrupted["native_reopen_and_subsequent_saves_passed"] = True
                interrupted["scope"] = "Host-injected hot rollback journal; native reopen and saves on disposable simulator only"
                (evidence / "interrupted-transaction.json").write_text(json.dumps(interrupted, indent=2) + "\n")
                run_ui_test(device, evidence, "testRotationPreservesSavedRecordsAndPlan",
                            "rotation-ui-tests.log", str(evidence / "rotation.xcresult"))
                rotation = verify_device_records(device, bundle, exports[0])
                rotation["landscape_portrait_checks_passed"] = True
                (evidence / "rotation.json").write_text(json.dumps(rotation, indent=2) + "\n")
                run_ui_test(device, evidence, "testNativePlanClipboardPastePreservesRecords",
                            "clipboard-ui-tests.log", str(evidence / "clipboard.xcresult"))
                clipboard = verify_device_records(device, bundle, exports[0])
                clipboard["native_copy_paste_checks_passed"] = True
                (evidence / "clipboard.json").write_text(json.dumps(clipboard, indent=2) + "\n")
                run_ui_test(device, evidence, "testMessageEditingCancelSaveAndRestart",
                            "message-edit-ui-tests.log", str(evidence / "message-edit.xcresult"))
                message_edit = verify_device_records(device, bundle, exports[0])
                message_edit["cancel_save_restart_and_restore_passed"] = True
                (evidence / "message-edit.json").write_text(json.dumps(message_edit, indent=2) + "\n")
                run_ui_test(device, evidence, "testManualAiPromptReviewAndCopyPreserveRecords",
                            "ai-handoff-ui-tests.log", str(evidence / "ai-handoff.xcresult"))
                handoff = verify_device_records(device, bundle, exports[0])
                handoff["review_copy_local_paste_and_restart_passed"] = True
                (evidence / "ai-handoff.json").write_text(json.dumps(handoff, indent=2) + "\n")
                print("Unsupported native storage failed closed and recovery preserved exact records.")
                print("Native rejected-write recovery and package reinstallation preserved exact records.")
                print("Apple interactive persistence and deletion test passed.")
            results = []
            labels = ("post-ui-launch", "relaunch") if args.ui_tests else ("first-launch", "relaunch")
            for label in labels:
                launched = sim("launch", device, bundle, timeout=120)
                results.append({"stage": label, "launch": launched})
                time.sleep(10)
                sim("io", device, "screenshot", str(evidence / (label + ".png")))
                # Termination fails if the app already crashed or exited.
                sim("terminate", device, bundle)
            (evidence / "result.json").write_text(json.dumps({
                "runtime": runtime["version"], "device": selected["name"],
                "device_family": args.device_family,
                "interactive_acceptance_passed": args.ui_tests,
                "launches": results, "scope": "Simulator only; physical-device acceptance outstanding",
            }, indent=2) + "\n")
            print("Apple simulator launch and relaunch completed; review screenshots.")
    except Exception:
        for filename in ("ui-tests.log", "interrupted-picker-ui-tests.log", "invalid-backup-ui-tests.log",
                         "rejected-write-ui-tests.log", "write-recovery-ui-tests.log",
                         "unsupported-storage-ui-tests.log", "storage-version-recovery-ui-tests.log",
                         "rotation-ui-tests.log", "clipboard-ui-tests.log", "accessibility-ui-tests.log",
                         "interrupted-transaction-ui-tests.log", "message-edit-ui-tests.log",
                         "ai-handoff-ui-tests.log"):
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
            ("failure-system.log", ["spawn", device, "log", "show", "--last", "5m",
             "--style", "compact", "--info", "--debug", "--predicate",
             'process == "App" OR process CONTAINS "WebKit" OR process == "SpringBoard" OR process == "runningboardd" OR process == "launchd"']),
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
        # The broad failure log can start after file selection.
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
            (str(evidence / "unsupported-storage.xcresult"), "unsupported-storage-attachments",
             "unsupported-storage-attachment-export.log"),
            (str(evidence / "storage-version-recovery.xcresult"), "storage-version-recovery-attachments",
             "storage-version-recovery-attachment-export.log"),
            (str(evidence / "rotation.xcresult"), "rotation-attachments",
             "rotation-attachment-export.log"),
            (str(evidence / "clipboard.xcresult"), "clipboard-attachments",
             "clipboard-attachment-export.log"),
            (str(evidence / "accessibility.xcresult"), "accessibility-attachments",
             "accessibility-attachment-export.log"),
            (str(evidence / "interrupted-transaction.xcresult"), "interrupted-transaction-attachments",
             "interrupted-transaction-attachment-export.log"),
            (str(evidence / "message-edit.xcresult"), "message-edit-attachments",
             "message-edit-attachment-export.log"),
            (str(evidence / "ai-handoff.xcresult"), "ai-handoff-attachments",
             "ai-handoff-attachment-export.log"),
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







