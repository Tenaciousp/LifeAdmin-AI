"""Export approved HomeAdmin artwork to existing platform asset sizes.

Developer utility: python -m pip install Pillow; python scripts/export_brand_assets.py
No image generation or network access; the approved master is never modified.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "branding/homeadmin-logo.png"
SIZES = {
  "native/android/app/src/main/res/drawable-land-hdpi/splash.png": [
    800,
    480
  ],
  "native/android/app/src/main/res/drawable-land-mdpi/splash.png": [
    480,
    320
  ],
  "native/android/app/src/main/res/drawable-land-xhdpi/splash.png": [
    1280,
    720
  ],
  "native/android/app/src/main/res/drawable-land-xxhdpi/splash.png": [
    1600,
    960
  ],
  "native/android/app/src/main/res/drawable-land-xxxhdpi/splash.png": [
    1920,
    1280
  ],
  "native/android/app/src/main/res/drawable-port-hdpi/splash.png": [
    480,
    800
  ],
  "native/android/app/src/main/res/drawable-port-mdpi/splash.png": [
    320,
    480
  ],
  "native/android/app/src/main/res/drawable-port-xhdpi/splash.png": [
    720,
    1280
  ],
  "native/android/app/src/main/res/drawable-port-xxhdpi/splash.png": [
    960,
    1600
  ],
  "native/android/app/src/main/res/drawable-port-xxxhdpi/splash.png": [
    1280,
    1920
  ],
  "native/android/app/src/main/res/drawable/splash.png": [
    480,
    320
  ],
  "native/android/app/src/main/res/mipmap-hdpi/ic_launcher.png": [
    72,
    72
  ],
  "native/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png": [
    162,
    162
  ],
  "native/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png": [
    72,
    72
  ],
  "native/android/app/src/main/res/mipmap-mdpi/ic_launcher.png": [
    48,
    48
  ],
  "native/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png": [
    108,
    108
  ],
  "native/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png": [
    48,
    48
  ],
  "native/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png": [
    96,
    96
  ],
  "native/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png": [
    216,
    216
  ],
  "native/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png": [
    96,
    96
  ],
  "native/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png": [
    144,
    144
  ],
  "native/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png": [
    324,
    324
  ],
  "native/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png": [
    144,
    144
  ],
  "native/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png": [
    192,
    192
  ],
  "native/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png": [
    432,
    432
  ],
  "native/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png": [
    192,
    192
  ],
  "native/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png": [
    1024,
    1024
  ],
  "native/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png": [
    2732,
    2732
  ],
  "native/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png": [
    2732,
    2732
  ],
  "native/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png": [
    2732,
    2732
  ]
}
BACKGROUND = "#3d08bb"


def main():
    with Image.open(MASTER) as original:
        assert original.width == original.height, "The approved master must be square"
        master = original.convert("RGB")
    outputs = dict(SIZES)
    outputs.update({
        "artifacts/adminpilot-ai/public/homeadmin-logo.png": [512, 512],
        "artifacts/adminpilot-ai/public/homeadmin-icon-192.png": [192, 192],
        "artifacts/adminpilot-ai/public/homeadmin-icon-180.png": [180, 180],
    })
    for name, size in outputs.items():
        # Use a 512px production source. Integer scaling keeps native exports
        # small without changing colours or adding compression artefacts.
        final_size = tuple(size)
        scale = 3 if min(size) > 2000 else 2 if min(size) > 512 else 1
        size = [value // scale for value in size]
        width, height = size
        if "splash" in name.lower() or "_foreground" in name:
            # Keep artwork within launch-screen crops and adaptive-icon masks.
            fraction = 0.42 if "splash" in name.lower() else 0.58
            edge = round(min(size) * fraction)
            image = Image.new("RGB", tuple(size), BACKGROUND)
            # Blend only the empty purple margin into the platform background.
            # The lettering starts farther inside and remains fully opaque.
            margin = max(1, round(edge * 0.025))
            mask = Image.new("L", (edge, edge), 0)
            ImageDraw.Draw(mask).rectangle((margin, margin, edge - margin - 1, edge - margin - 1), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(margin / 2))
            image.paste(master.resize((edge, edge), Image.Resampling.LANCZOS),
                        ((width - edge) // 2, (height - edge) // 2), mask)
        else:
            image = master.resize(tuple(size), Image.Resampling.LANCZOS)
        if scale > 1:
            image = image.resize(final_size, Image.Resampling.NEAREST)
        target = ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        # Publish only complete images, even if an export is interrupted.
        with TemporaryDirectory(dir=target.parent) as temporary:
            staged = Path(temporary) / "export.png"
            image.save(staged, optimize=True)
            with Image.open(staged) as checked:
                assert checked.size == final_size and checked.mode == "RGB", name
                checked.verify()
            staged.replace(target)
    print(f"Exported and checked {len(outputs)} HomeAdmin PNG assets.")


if __name__ == "__main__":
    main()
