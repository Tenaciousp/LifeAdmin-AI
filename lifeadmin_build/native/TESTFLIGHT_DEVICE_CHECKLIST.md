# HomeAdmin first TestFlight device checklist

Prepared 20 October 2026. Every result starts as NOT TESTED. This checklist records physical-device evidence separately from simulator results. Signing, Apple upload, tester access and installation must complete before execution. A signed IPA artifact alone is not a TestFlight installation.

Use invented records and a dedicated test calendar. Keep real household details, credentials and private backups out of screenshots and reports. Do not uninstall an installation containing records without first exporting and checking a backup.

## Build record

Complete one copy per device and build.

| Field | Recorded value |
| --- | --- |
| Tester and test date | Pending |
| Device model and OS version | Pending |
| HomeAdmin version and build number shown in TestFlight | Pending |
| Source commit and signed-build run URL | Pending |
| Install route | TestFlight, pending |
| Network state | Pending |
| Calendar type and time zone | Pending |

Record PASS, FAIL, BLOCKED or NOT TESTED for each row, plus the exact error and an invented-data screenshot when useful. A missing device or OS leaves a coverage gap; do not record a pass by inference.

## First session

Allow roughly 45 to 60 minutes as a planning estimate. Calendar alerts and upgrade delivery need separate follow-up sessions.

| ID | Action | Required observation | Result |
| --- | --- | --- | --- |
| D01 | Install through TestFlight and launch. | HomeAdmin opens without an app account, trial, payment or sign-in screen. | NOT TESTED |
| D02 | Enable airplane mode and disable Wi-Fi. Search for Cancel Netflix, choose a suggestion, name the bill Test subscription and save. | Offline suggestions work; one bill appears; saving alone requests no calendar permission. | NOT TESTED |
| D03 | Create a plan, reviewing any missing-details continuation. Close the app through the app switcher and reopen offline. | Saved bill and plan match the acknowledged values. | NOT TESTED |
| D04 | Edit the provider message, cancel, then reopen the editor. Edit again, save, close and reopen the app. | Cancel preserves the original draft; Save preserves the revised subject/body after restart. Bill and guidance stay unchanged. | NOT TESTED |
| D05 | Copy the saved plan and message into an unsent local note. | Each clipboard result matches its selected source; nothing is sent to a provider. | NOT TESTED |
| D06 | Export a backup through Files. Add After backup as a second bill. Start restoring and cancel file selection; repeat and decline replacement. | The original bill, plan and second bill survive both cancellations. | NOT TESTED |
| D07 | Restore the exported backup and approve replacement. Restart offline. | Original bill, plan and saved message return; After backup is absent because restore replaces records. | NOT TESTED |
| D08 | Repeat export/restore using an available cloud file provider. Test cancellation and an unavailable file. | Successful restore matches the export; cancelled/failed attempts preserve current records. Record provider and observed limits. | NOT TESTED |
| D09 | Prepare an AI prompt from the saved plan. Inspect defaults, select/exclude the invented reference and edit the question. Copy into an unsent local note. | Reference, free-text details and saved message are excluded by default. Selected fields follow the controls; copied text matches the reviewed question. | NOT TESTED |
| D10 | Select a preferred AI service, restart and reopen AI review. Optionally open the named link using invented details only. | Service preference persists; temporary question edits disappear; saved message edits remain. Opening the service does not automatically submit the question. | NOT TESTED |
| D11 | Paste a synthetic AI reply into Edit message, save, restart and export/restore. | The saved reply survives both restart and backup restoration. | NOT TESTED |
| D12 | Rotate, enlarge text and follow the main flow with VoiceOver and an available keyboard. | Save, Cancel, Copy, Close and backup controls remain readable, reachable and correctly labelled. Record each input method separately. | NOT TESTED |

## Calendar session

Use a disposable calendar containing an unrelated synthetic event. Keep another device disconnected from this calendar during testing to avoid confusing device-specific duplicate entries.

| ID | Action | Required observation | Result |
| --- | --- | --- | --- |
| C01 | Choose Connect calendar and deny permission. Grant permission later through the supported settings route, then select a writable test calendar. | Denial is explained without losing bills; retry works. Record the permission wording and OS version. | NOT TESTED |
| C02 | Enable diary dates for one bill and enter future expiry, renewal, cancellation-notice and follow-up dates. Save repeatedly and restart. | One corresponding event per date type, neutral titles, no provider name/reference and no duplicates. | NOT TESTED |
| C03 | Edit dates, disable diary, mark done, delete a test bill and restore a backup, checking events after each action. | Linked entries follow the current saved records; unrelated events remain untouched. | NOT TESTED |
| C04 | Revoke permission, reopen, then grant access again. Test a read-only/no-writable calendar where available. | Clear recovery/error state; no record loss or false success. | NOT TESTED |
| C05 | Disconnect once keeping entries and once removing managed entries. Remove/move a test event externally and reconnect. | The selected choice is respected; recovery does not modify unrelated events or create duplicates. | NOT TESTED |
| C06 | Schedule a near-term alert using supported options. Observe while backgrounded/locked. Test dates around a daylight-saving transition and another time zone on a controlled test device. Restore settings afterwards. | Record actual event dates, alert time, time zone, device notification settings and receipt. An event appearing is not proof of alert delivery. | NOT TESTED |

Legacy iOS 16.4 permission behaviour and iOS 17+ full access require separate coverage. An unavailable OS/device is BLOCKED, not PASS. Android coverage is separate.

## Later signed update and privacy evidence

- Install a newer numbered TestFlight build over acknowledged saved records without uninstalling. Record both build numbers; compare every bill, plan and edited-message field, save another change, restart and restore the older export. This needs two processed builds.
- Review final signed-package identity, entitlements and privacy manifests against the tested source. Physical network observation must separate HomeAdmin requests from Apple/TestFlight, cloud Files, calendar-provider and deliberately opened AI-service activity. Record method, duration, limitations and any capture loss. Offline success alone does not prove zero network traffic.
- OS cloud backup/device transfer is a separate recovery test. Record configured support and observed recovery separately; a purchase re-download does not establish household-record recovery.

Any data loss, incorrect restore, duplicate/unrelated calendar mutation, blocked essential control or unexpected household-data transmission blocks acceptance until investigated and retested. Leave unexecuted checks open. Simulator passes do not close these rows.

Related project guides: [Device testing](DEVICE_TESTING.md), [TestFlight setup](TESTFLIGHT_SETUP.md), [Diary and AI acceptance](../DIARY_AI_ACCEPTANCE.md).
