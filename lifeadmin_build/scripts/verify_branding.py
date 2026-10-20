"""Check current public branding while retaining compatibility identifiers."""
import json
from pathlib import Path
import plistlib
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def main():
    app = ROOT / "artifacts/adminpilot-ai"
    old_name = re.compile(r"\bLifeAdmin(?: AI)?(?![\w-])")
    visible = [app / "index.html", app / "public/site.webmanifest"]
    visible += [p for p in (app / "src").rglob("*")
                if p.suffix in (".tsx", ".mjs")]
    visible += [ROOT / "native/ios/App/App/Info.plist",
                ROOT / "native/android/app/src/main/res/values/strings.xml",
                ROOT / "STORE_SUBMISSION.md", ROOT / "MONETISATION.md"]
    for path in visible:
        assert not old_name.search(path.read_text()), path
    config = json.loads((ROOT / "native/capacitor.config.json").read_text())
    assert config["appName"] == "HomeAdmin"
    assert config["appId"] == "uk.co.tenaciouspl.lifeadmin"
    info = plistlib.loads((ROOT / "native/ios/App/App/Info.plist").read_bytes())
    assert info["CFBundleDisplayName"] == "HomeAdmin"
    android = ET.parse(ROOT / "native/android/app/src/main/res/values/strings.xml")
    assert android.find("./string[@name='app_name']").text == "HomeAdmin"
    manifest = json.loads((app / "public/site.webmanifest").read_text())
    assert manifest["name"] == manifest["short_name"] == "HomeAdmin"
    for icon in manifest["icons"]:
        data = (app / "public" / icon["src"].lstrip("/")).read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n"
        assert "%sx%s" % struct.unpack(">II", data[16:24]) == icon["sizes"]
    icon = ROOT / "native/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
    data = icon.read_bytes()
    assert struct.unpack(">II", data[16:24]) == (1024, 1024)
    assert data[25] == 2, "Apple icon must be opaque RGB"
    print("HomeAdmin public names, platform identifiers and icon sizes verified.")


if __name__ == "__main__":
    main()
