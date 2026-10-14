"""Launch the compiled customer app in a disposable CI iPhone simulator.

Screenshots require human review. This is not household-data or device acceptance.
"""
import json
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
        # Fresh iOS runtimes perform data migration on their first boot. CI #325
        # finished migration but its subsequent app launch timed out. Reboot the
        # disposable simulator before installation to separate OS setup from
        # customer-app acceptance. Do not retry or suppress app launch failures.
        sim("shutdown", device, timeout=120)
        sim("boot", device)
        sim("bootstatus", device, "-b", timeout=300)
        sim("install", device, str(app.resolve()), timeout=120)
        results = []
        for label in ("first-launch", "relaunch"):
            launched = sim("launch", device, bundle, timeout=120 if label == "first-launch" else 60)
            results.append({"stage": label, "launch": launched})
            time.sleep(10)
            sim("io", device, "screenshot", str(evidence / (label + ".png")))
            # Termination fails if the app already crashed or exited.
            sim("terminate", device, bundle)
        (evidence / "result.json").write_text(json.dumps({
            "runtime": runtime["version"], "device": phones[-1]["name"],
            "preparation": "Fresh simulator boot, OS migration, reboot, then app install",
            "launches": results, "scope": "Launch and relaunch only; screenshots need review",
        }, indent=2) + "\n")
        print("Apple simulator launch and relaunch completed; review screenshots.")
        if "--ui-tests" in sys.argv:
            with (evidence / "ui-tests.log").open("w") as log:
                subprocess.run([
                    "xcodebuild", "-project", "ios/App/App.xcodeproj",
                    "-scheme", "LifeAdminAcceptance", "-configuration", "Debug",
                    "-destination", "platform=iOS Simulator,id=" + device,
                    "-derivedDataPath", "build-ios-simulator",
                    "-resultBundlePath", "apple-ui-tests.xcresult",
                    "-parallel-testing-enabled", "NO",
                    "-test-timeouts-enabled", "YES",
                    "-default-test-execution-time-allowance", "180",
                    "-maximum-test-execution-time-allowance", "300",
                    "CODE_SIGNING_ALLOWED=NO", "test",
                ], check=True, stdout=log, stderr=subprocess.STDOUT, timeout=900)
            print("Apple interactive persistence and deletion test passed.")
    except Exception:
        # Preserve synthetic simulator evidence before removing the disposable device.
        diagnostics = [
            ("failure-screen.log", ["io", device, "screenshot", str(evidence / "failure.png")]),
            ("failure-system.log", ["spawn", device, "log", "show", "--last", "2m",
             "--style", "compact", "--predicate", 'process == "App" OR process == "SpringBoard"']),
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
        subprocess.run(["xcrun", "simctl", "shutdown", device], check=False, timeout=60)
        subprocess.run(["xcrun", "simctl", "delete", device], check=False, timeout=60)


if __name__ == "__main__":
    main()
