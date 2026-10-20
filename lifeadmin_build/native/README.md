# Native development build

This is a development scaffold, not a signed or accepted store release.

App name: HomeAdmin. Bundle/application ID: uk.co.tenaciouspl.lifeadmin.
Both projects use the local customer bundle in
../artifacts/adminpilot-ai/dist-local/public. There is no server.url override,
live reload endpoint, account, Stripe checkout or analytics integration.
Icons and splash screens use the approved HomeAdmin artwork; final store screenshot
and screenshots still need review.

Apple deployment requires iOS/iPadOS 16.4 or later, matching the bundled Tailwind 4 UI.
The native configuration check rejects a lower deployment target. Older Apple
systems are outside this release's support floor; minimum-version device acceptance
remains required before store submission.

Reference: https://tailwindcss.com/docs/upgrade-guide

## Prepare and synchronize

Use Node 22 or later for the native toolchain. Install the root JavaScript
dependencies from lifeadmin_build, then install native dependencies:

    npm ci
    cd native
    npm ci
    npm run sync -- android

For Apple, run npm run sync -- ios from native. The sync script rebuilds the
local customer package and runs its endpoint-exclusion check before copying
assets. A failed build or validation stops synchronization. Generated web assets
and signing material are excluded from source control.

Open projects with npm run android or npm run ios from native. Android Studio
and the Android SDK are required for Android builds. Apple compilation needs a
Mac and Xcode 26 or later. This workspace generated the projects and checked the
configuration, but has neither Xcode nor the Android SDK. CI #313 compiled an Android debug APK and passed the native SQLite unit tests.
CI now retains a development APK and native test reports for 14 days under the
workflow run’s Artifacts section. Download the APK artifact, extract it and use
it only for controlled testing on a supported Android device. Debug packages
are not store releases and do not establish upgrade or physical-device acceptance.
No release AAB, IPA, signing key, store upload or release acceptance is claimed.

## Native storage implementation and acceptance

The native customer screen now selects an app-private SQLite repository through
the LifeAdminStorage bridge. Web builds retain IndexedDB. Native startup fails
closed if the bridge or existing records are unreadable; there is no silent
WebView-storage fallback. The native database stores a versioned snapshot and
uses a transaction plus expected revision to reject overlapping stale writes.
The JavaScript repository reloads and retries a conflicting edit a bounded number
of times. Success is acknowledged only after native transaction commit.

Synthetic JavaScript contract tests cover reconnect, save/restore, concurrent
edits, failed commit, failed replacement, invalid imports, deletion and corrupt
storage. These tests use an injected bridge and do not prove physical-device
durability. Android compilation and native SQLite tests passed in CI #361.
Native file export and import use the system document picker on both platforms.
Selected UTF-8 backup files are bounded to 5 MiB and pass full snapshot
validation before replacement. Exports use a customer-chosen destination;
no permanent file-provider permission is retained.

Apple simulator acceptance passed in CI #361, including backup round-trip,
cancellation, replacement decisions, process interruption, invalid-file rejection
and exact bill/plan field comparison against the real exported JSON.
Apple export staging copies are removed after completion or cancellation;
abandoned staging folders are removed on the next plugin load after force-close.
Temporary import copies are removed after reading, preserving the original
selected backup.

Physical file-picker usability, cross-version app updates, disk exhaustion,
interrupted writes, OS backup/restore and device transfer remain release gates.
The passing same-build package reinstall does not prove uninstall/re-download
recovery or cross-version migration. No guaranteed OS backup or reinstall
recovery is promised. Existing server records are preserved.

Keep the version-1 export format and local result contract compatible when the
native repository is connected. Import validation must complete before
replacement; failed replacement must preserve the previous saved state.
No Tenaciouspl recovery service is provided. Android OS backup rules explicitly
include only the native database directory, excluding WebView state and other
app files. Cloud backup requires the platform’s encryption capability; device
transfer is configured separately on Android 12 and later. These declarations
do not prove that a customer’s settings, provider or device support restoration.
Verify OS restore on supported devices before claiming it works.

Backup rule reference: https://developer.android.com/identity/data/autobackup

## Apple compilation in CI

The unsigned simulator build uses GitHub’s standard macOS runner, without an
Apple account, signing secrets or store upload. The job is guarded to run only
while the repository is public. Compilation evidence is retained for 14 days.
[CI #361](https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/38945509433)
passed at source `00e9218a978be7754c487856daeb35c458d17745`, using an
iPhone 11 simulator with iOS 26.5 and synthetic records only.

| Simulator check | Verified result |
| --- | --- |
| Export/delete/restore and replacement decisions | Exact original bill and plan fields restored |
| Import/export picker cancellation and force-close | Records preserved; fresh picker requests work |
| Malformed JSON, future version, invalid plan and oversized file | Rejected without replacement confirmation; records preserved after restart |
| Abandoned export staging | No private staging folders after restart; original exported backup retained |
| Same-build package reinstall over the populated app | Exact saved fields retained |
| Injected SQLite INSERT rejection | Failure reported without a success message; saved records unchanged after restart |
| Saving after rejection is removed | Done/Open changes persisted across restarts; final records match the original export |
| Final launch/relaunch | Both passed; customer screenshots reviewed |

The rejected-write test uses a host-created SQLite trigger on the disposable
simulator, with removal in a finally block. No failure hook is shipped in the app.
SQL rejection is not a disk-full or power-loss test.

Reviewed evidence includes `backup-round-trip.json`, `storage-recovery.json`,
`result.json`, UI logs and customer screenshots. All recorded acceptance flags
passed. Expanded native backup work is tracked in issue #3; approved public QA
results are recorded on PR #2. Minimum-supported-OS, cloud-provider, physical-device
and store acceptance remain separate.

## Required device acceptance

See [DEVICE_TESTING.md](DEVICE_TESTING.md) for Android installation, the first
acceptance pass and Mac compilation commands.

Record device, OS version, build/commit, result and evidence for each check.

| Check | Required outcome |
| --- | --- |
| First launch and airplane mode | Account-free workflow opens and generates plans from bundled assets |
| Restart and force quit | Previously acknowledged bills/plans reopen unchanged |
| App upgrade | Existing records and backup compatibility survive the update |
| Failed write and storage pressure | Error shown without losing the previous saved state |
| File export | Customer chooses a private destination and verifies the saved file |
| File restore | Valid export restores; malformed/oversized imports preserve current records |
| Replacement and deletion | Clear confirmation, matching bill/plan deletion and no stale visible result |
| OS cloud backup | Verify each supported setting and restore path before describing support |
| Reinstall/new device | Distinguish purchase re-download from data restoration; verify supported routes |
| Privacy | No household-data requests, analytics, account or automatic AI handoff |
| Accessibility | Keyboard, screen reader, zoom, touch targets, focus and rotation work |
| Support link | Opens the Tenaciouspl examples/support site after customer selection |

Complete synthetic and build checks first. Physical iPad QA follows last,
as previously requested. Also test a supported Android phone before submission.
Store accounts, seller/privacy details, local-equivalent upfront pricing,
refund wording, privacy declarations and submission materials remain release
tasks. No voluntary 14-day refund promise has been approved.

Sources checked 13 October 2026:
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/config
- https://capacitorjs.com/docs/guides/storage
