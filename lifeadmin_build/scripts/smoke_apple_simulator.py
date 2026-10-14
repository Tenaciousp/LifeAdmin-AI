"""Launch the compiled customer app in a disposable CI iPhone simulator.

Screenshots require human review. This is not household-data or device acceptance.
"""
import json
from pathlib import Path
import subprocess
import time


def sim(*args, timeout=60):
    result = subprocess.run(
        ["xcrun", "simctl", *args], check=True, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout,
    )
    return result.stdout.strip()


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
        results = []
        for label in ("first-launch", "relaunch"):
            launched = sim("launch", device, bundle)
            results.append({"stage": label, "launch": launched})
            time.sleep(10)
            sim("io", device, "screenshot", str(evidence / (label + ".png")))
            # Termination fails if the app already crashed or exited.
            sim("terminate", device, bundle)
        (evidence / "result.json").write_text(json.dumps({
            "runtime": runtime["version"], "device": phones[-1]["name"],
            "launches": results, "scope": "Launch and relaunch only; screenshots need review",
        }, indent=2) + "\n")
        print("Apple simulator launch and relaunch completed; review screenshots.")
    finally:
        subprocess.run(["xcrun", "simctl", "shutdown", device], check=False, timeout=60)
        subprocess.run(["xcrun", "simctl", "delete", device], check=False, timeout=60)


if __name__ == "__main__":
    main()
