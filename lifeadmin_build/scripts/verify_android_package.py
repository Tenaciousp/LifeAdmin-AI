"""Inspect the compiled development APK, not only its input files."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from zipfile import ZipFile

APP_ID = "uk.co.tenaciouspl.lifeadmin"
FORBIDDEN = ("/api/auth/", "/api/tasks", "/api/notes", "/api/agent",
             "/api/checkout", "/api/products", "/api/analytics")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def inspect_assets(apk):
    with ZipFile(apk) as package:
        names = set(package.namelist())
        require("assets/public/index.html" in names, "Offline entry page missing")
        config = json.loads(package.read("assets/capacitor.config.json"))
        require(config.get("appId") == APP_ID, "Unexpected application ID")
        require(config.get("appName") == "LifeAdmin", "Unexpected app name")
        require(not config.get("server"), "Remote server configuration in APK")
        for resource in ("backup_rules.xml", "data_extraction_rules.xml"):
            require("res/xml/" + resource in names, "Backup resource missing: " + resource)
        scripts = [name for name in names if name.startswith("assets/public/") and name.endswith(".js")]
        require(scripts, "Offline JavaScript missing")
        source = "\n".join(package.read(name).decode("utf-8") for name in scripts)
        for endpoint in FORBIDDEN:
            require(endpoint not in source, "Hosted customer endpoint in APK: " + endpoint)
        for text in ("lifeadmin-device-v1", "Export backup", "Restore backup"):
            require(text in source, "Offline feature missing: " + text)


def aapt2_path():
    tool = shutil.which("aapt2")
    if tool:
        return tool
    for variable in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        sdk = os.environ.get(variable)
        if sdk:
            candidates = list((Path(sdk) / "build-tools").glob("*/aapt2"))
            if candidates:
                return str(max(candidates, key=lambda p: tuple(int(n) for n in re.findall(r"\d+", p.parent.name))))
    raise RuntimeError("Android SDK aapt2 is required for APK inspection")


def inspect_manifest(apk, tool):
    def dump(kind, *options):
        return subprocess.run([tool, "dump", kind, str(apk), *options], check=True,
                              capture_output=True, text=True).stdout
    badge = dump("badging")
    require("package: name='" + APP_ID + "'" in badge, "Incorrect packaged identity")
    require("application-label:'LifeAdmin'" in badge, "Incorrect packaged display name")
    require("sdkVersion:'24'" in badge, "Unexpected minimum Android version")
    require("targetSdkVersion:'36'" in badge, "Unexpected target Android version")
    permissions = set(re.findall(r"uses-permission(?:-[^: ]+)?:\s*(?:name=)?'([^']+)'", dump("permissions")))
    allowed = {"android.permission.INTERNET", APP_ID + ".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"}
    require("android.permission.INTERNET" in permissions, "Unable to verify APK permissions")
    require(permissions <= allowed, "Unexpected APK permissions: " + ", ".join(sorted(permissions - allowed)))
    manifest = dump("xmltree", "--file", "AndroidManifest.xml")
    for attribute in ("fullBackupContent", "dataExtractionRules"):
        require(attribute in manifest, "Packaged backup configuration missing: " + attribute)


if __name__ == "__main__":
    apk = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("native/android/app/build/outputs/apk/debug/app-debug.apk")
    inspect_assets(apk)
    inspect_manifest(apk, aapt2_path())
    print("Compiled APK identity, permissions, offline assets and backup configuration verified.")
