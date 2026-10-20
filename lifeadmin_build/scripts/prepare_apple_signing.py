"""Validate a private distribution profile and configure this runner's checkout.

Inputs stay under RUNNER_TEMP. Never print profile contents or certificate data.
"""
import datetime as dt
import os
from pathlib import Path
import plistlib
import subprocess
import uuid

TEAM = "C8T85FCR6R"
BUNDLE = "uk.co.tenaciouspl.lifeadmin"


def validate_profile(profile, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    expiry = profile.get("ExpirationDate")
    if not isinstance(expiry, dt.datetime):
        raise ValueError("Profile has no expiry date")
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=dt.timezone.utc)
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [TEAM]:
        raise ValueError("Profile belongs to a different Apple team")
    if entitlements.get("application-identifier") != TEAM + "." + BUNDLE:
        raise ValueError("Profile must match the existing explicit app identifier")
    if entitlements.get("com.apple.developer.team-identifier") != TEAM:
        raise ValueError("Profile entitlement has the wrong team")
    if expiry <= now:
        raise ValueError("Distribution profile has expired")
    if (profile.get("ProvisionedDevices") is not None
            or profile.get("ProvisionsAllDevices")
            or entitlements.get("get-task-allow") is not False
            or "iOS" not in profile.get("Platform", [])):
        raise ValueError("Use an iOS App Store Connect distribution profile")
    return str(uuid.UUID(profile["UUID"])).upper()


def main():
    temporary = Path(os.environ["RUNNER_TEMP"])
    number = os.environ["APPLE_BUILD_NUMBER"]
    if not number.isascii() or not number.isdigit() or not 1 <= int(number) <= 9999:
        raise ValueError("Use an unused integer build number between 1 and 9999")
    data = subprocess.check_output([
        "security", "cms", "-D", "-i", str(temporary / "homeadmin.mobileprovision")
    ], stderr=subprocess.DEVNULL)
    profile_id = validate_profile(plistlib.loads(data))
    (temporary / "profile-uuid.txt").write_text(profile_id)
    # Configure only the app's Release target, never SPM/framework targets.
    project = Path("ios/App/App.xcodeproj/project.pbxproj")
    converted = temporary / "project.plist"
    subprocess.run(["plutil", "-convert", "xml1", "-o", str(converted), str(project)], check=True)
    tree = plistlib.loads(converted.read_bytes())
    objects = tree["objects"]
    updated = 0
    for target in list(objects.values()):
        if target.get("productType") != "com.apple.product-type.application":
            continue
        configs = objects[target["buildConfigurationList"]]["buildConfigurations"]
        for config_id in configs:
            config = objects[config_id]
            settings = config["buildSettings"]
            if config["name"] != "Release" or settings.get("PRODUCT_BUNDLE_IDENTIFIER") != BUNDLE:
                continue
            settings.update(CODE_SIGN_STYLE="Manual", CODE_SIGN_IDENTITY="Apple Distribution",
                            DEVELOPMENT_TEAM=TEAM, PROVISIONING_PROFILE_SPECIFIER=profile_id,
                            CURRENT_PROJECT_VERSION=str(int(number)))
            updated += 1
    if updated != 1:
        raise ValueError("Expected exactly one matching app Release configuration")
    project.write_bytes(plistlib.dumps(tree))
    (temporary / "ExportOptions.plist").write_bytes(plistlib.dumps({
        "method": "app-store-connect", "destination": "export", "teamID": TEAM,
        "signingStyle": "manual", "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {BUNDLE: profile_id}, "manageAppVersionAndBuildNumber": False,
    }))
    print("Distribution profile validated; runner-only signing configuration prepared.")


if __name__ == "__main__":
    main()
