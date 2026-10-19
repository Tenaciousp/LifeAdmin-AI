# HomeAdmin branding

Approved by the owner on 19 October 2026.

- Product and app display name: **HomeAdmin**.
- Publisher brand: **TenaciousPL**.
- Apple listing: **HomeAdmin**, subtitle **By TenaciousPL**, saved in the existing record.
- Legal seller: Paul Lonergan. Address review is still deferred.
- Strapline: **List, plan and save.**
- Website: https://tenaciouspl.co.uk
- Support: tenaciouspl@icloud.com

## Approved artwork

Production source: `branding/homeadmin-logo.png`, a 512px export of the
owner-approved full-resolution artwork. The full-resolution original remains
in website source commit `ac034ec6a4d49c8a69623c59e38c6c542c16aeb2`, at
`dist/assets/homeadmin-logo.png`. This is the owner-approved middle-ground
design: purple square, ivory paper/planner lettering, round o, teal tick above i,
restrained binder/calendar details and digital pixels. The earlier bulky and flat
drafts are superseded for current promotion.

`scripts/export_brand_assets.py` exports the master without redesigning it to
the existing Apple and Android asset dimensions and to web/PWA icon sizes.
Large native images use integer scaling to limit package size. No palette
reduction or lossy compression is applied to the production source.
Pillow is a developer-only export dependency. Run
`python scripts/export_brand_assets.py` after deliberately replacing the master.
The Apple app icon is opaque RGB, 1024 x 1024. Adaptive foreground and launch
artwork have padding for platform masks/crops; physical-device appearance still
requires review. The export utility checks dimensions and RGB mode.

Website version 13 uses the approved master for the header, hero, browser icon,
Apple touch icon and social preview across the home, support and privacy pages.
Repository app headers, metadata, native display names, permission descriptions,
calendar titles, backup filenames, support messages and release drafts use
HomeAdmin. The retained hosted development product is not the paid native app.

## Compatibility names retained deliberately

Public naming does not change app identity or existing records. Preserve:

- Bundle/application ID `uk.co.tenaciouspl.lifeadmin`, Team ID `C8T85FCR6R` and SKU
  `tenaciouspl-lifeadmin-ios`.
- Repository, workspace, package and class names, including native bridge names.
- SQLite and IndexedDB locations, browser preference keys and backup format
  marker `lifeadmin-backup`, version 1.
- Calendar ownership IDs and old ownership-note recognition. Managed old events
  are found before their visible title/note is updated to HomeAdmin.

New exports are named `homeadmin-backup.json` (native) or
`homeadmin-backup-YYYY-MM-DD.json` (web). Old filenames still import because the
data format is unchanged. The native acceptance picker recognises both brands;
the pinned older upgrade baseline deliberately continues using its old filename.

## Historical evidence and remaining publication work

Earlier dated QA reports, screenshots, review PDFs and build artifacts retain
the names and bytes originally tested. They are historical evidence, not current
HomeAdmin launch assets. Notes on historical documents identify the current
product name without rewriting their findings.

Fresh native screenshot jobs must run against the renamed candidate. Do not
retouch old captures to imply a new native test pass. Signing, TestFlight,
physical-device checks, calendar permission/event migration checks, minimum-OS
and manual accessibility review remain separate gates. App Store name acceptance
is not final trademark clearance. No signed release or store submission is
authorised by this branding update.
