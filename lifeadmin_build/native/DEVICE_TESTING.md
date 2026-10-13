# LifeAdmin device testing

This is a development test guide. Passing compilation does not establish device
acceptance or store approval. Use invented household records for these checks.

## Android installation

1. Open the latest successful LifeAdmin CI run from the draft PR:
   https://github.com/Tenaciousp/LifeAdmin-AI/pull/2.
2. Under **Artifacts**, download the `lifeadmin-android-debug-…` ZIP and extract
   `app-debug.apk`. Record the run link so the tested build is identifiable.
3. Transfer the APK to your Android test phone and open it. If Android prompts
   for installation permission, follow the device's settings for that specific
   file-opening app. Keep Play Protect enabled. Installation settings vary by
   device; do not change unrelated security settings.
4. Open **LifeAdmin**. There should be no LifeAdmin account, sign-in, trial,
   checkout or pricing screen. The debug APK does not test a paid store download.

Android installation reference:
https://support.google.com/pixelphone/answer/7391672

## First acceptance pass

Record the phone model, Android version, CI run, date, pass/fail and any error
message. Keep screenshots of invented records only.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Enable airplane mode, including switching Wi-Fi off. Search for `Cancel Netflix` and select **Use suggestion**. | Suggestions work without a connection. |
| 2 | Give the bill the name `Test subscription`, add invented details and choose **Save bill**. | Exactly one saved bill appears. |
| 3 | Choose **Create plan**. If missing details are highlighted, review and confirm the offered continuation. | A readable plan is saved without contacting a provider. |
| 4 | Choose **Copy plan**, then paste into a local test note. Repeat with **Copy message** when a message is present. | The intended text is copied once, with no duplicate provider draft. Nothing is sent automatically. |
| 5 | Force-stop LifeAdmin through Android app settings, then reopen it while offline. | The acknowledged bill and plan reopen unchanged. |
| 6 | Choose **Manage backups**, then **Export backup** and select an on-device destination. | A readable JSON backup is saved at the chosen location. |
| 7 | Add a second invented bill named `After backup`. Choose **Restore backup** and cancel file selection. | Both existing bills and the saved plan remain unchanged. |
| 8 | Select the exported backup but decline replacement confirmation. | Existing records remain unchanged. |
| 9 | Select the same backup and confirm replacement. | The first bill and plan return; `After backup` is removed because restore replaces records. |
| 10 | Create a small file named `invalid-backup.json` containing `{}`. Try restoring it. | A validation error appears and the previous records remain unchanged. |
| 11 | Delete the restored bill and confirm. Reopen the app. | Both the bill and its associated plan remain deleted. |
| 12 | Restore the valid exported backup once more. | The bill and plan return. |
| 13 | Reconnect, select **Examples & support**, return to LifeAdmin and reopen the saved plan. | The Tenaciouspl website opens and app records remain available. |
| 14 | Increase text size, rotate the phone and use TalkBack through the main flow. | Labels, focus, reading order and controls remain usable without hidden actions. |

Send the device/build details, failed step and exact error text through the
existing support route. A description is usually sufficient; household records
or backup files are not needed for the initial report.

## Apple compilation on a Mac

This project uses Capacitor 8.5.3, Node 22 or later and Xcode 26 or later.
Use the existing repository branch `dev/energy-renewal-plan`. From its
`lifeadmin_build` directory:

```bash
npm ci
cd native
npm ci
npm run sync -- ios
npm run ios
```

In Xcode, choose the **App** scheme and an iPhone simulator, then build/run.
The simulator pass precedes physical iPad QA. Alternatively, from `native`:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Save the build result and any errors. Compilation has not yet been verified on
a Mac. Simulator success does not establish iCloud backup, physical file-provider
behaviour or store acceptance. A signed device build and store submission are
separate later steps.

Apple toolchain reference:
https://capacitorjs.com/docs/updating/8-0

## Later acceptance gates

- Upgrade an installed build with acknowledged records still present; confirm
  record and exported-backup compatibility. Do not uninstall as an upgrade test.
- Repeat backup selection with supported cloud file providers, including cancel,
  unavailable-file and interrupted-selection cases.
- Check supported OS backup/restore and device-transfer routes separately from
  manual JSON export/import. Record backup settings and provider. Purchase
  re-download alone does not recover household records.
- Check storage pressure and interrupted writes on controlled test devices;
  acknowledged records must survive or an error must preserve the previous state.
- Verify the customer workflow has no automatic household-data network requests.
- Complete physical iPad QA last, after compilation and the preceding checks.
- Finish signing, store purchase configuration, seller/privacy details, listing
  materials and store review. No voluntary 14-day refund promise is approved.

There is no Tenaciouspl recovery copy and no guaranteed OS restore route. Test
results must distinguish configured support from observed successful recovery.
