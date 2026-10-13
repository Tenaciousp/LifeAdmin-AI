# Native development build

This is a development scaffold, not a signed or accepted store release.

App name: LifeAdmin. Bundle/application ID: uk.co.tenaciouspl.lifeadmin.
Both projects use the local customer bundle in
../artifacts/adminpilot-ai/dist-local/public. There is no server.url override,
live reload endpoint, account, Stripe checkout or analytics integration.
Initial icons and splash screens use LifeAdmin branding; final store artwork
and screenshots still need review.

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
configuration, but has neither Xcode nor the Android SDK. No APK, AAB, IPA,
signing key, store upload or release acceptance is claimed.

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
durability. Android compilation is added to CI; Apple compilation still needs
Mac/Xcode. Native file export and import now use the system document picker on both
platforms. Selected UTF-8 backup files are bounded to 5 MB, then pass the same
full snapshot validation before replacement. Exports use a customer-chosen
destination; no permanent file-provider permission is retained. Cancellation
preserves saved records. Apple export staging copies are deleted after completion
or cancellation. Native compilation, file-picker usability, app-update,
storage-pressure, interruption and OS backup/restore acceptance remain release gates. No guaranteed OS backup
or reinstall recovery is promised. Existing server records are preserved.

Keep the version-1 export format and local result contract compatible when the
native repository is connected. Import validation must complete before
replacement; failed replacement must preserve the previous saved state.
No cloud or Tenaciouspl recovery service is provided.

## Required device acceptance

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
