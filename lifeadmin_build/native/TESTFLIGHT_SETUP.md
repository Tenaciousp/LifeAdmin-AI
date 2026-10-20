# HomeAdmin first TestFlight setup

Apple membership and App Store Connect access were confirmed by the Account Holder on 19 October 2026.

| Setting | Value |
| --- | --- |
| Apple developer Team ID | C8T85FCR6R |
| App Store name and app display name | HomeAdmin |
| Current Apple subtitle | By TenaciousPL |
| Bundle ID | uk.co.tenaciouspl.lifeadmin |
| Platform | iOS, including supported iPad devices |
| Primary language | English (U.K.) |
| Suggested internal SKU for a new record | tenaciouspl-lifeadmin-ios |
| Version | 1.0 |
| Seller | Paul Lonergan |
| Brand | TenaciousPL |

The Account Holder's 19 October screenshot confirms **HomeAdmin** saved in the existing App Store Connect record, with **By TenaciousPL** as its subtitle. The bundle ID and SKU remain unchanged. The numeric Apple app ID has not yet been recorded here. Name acceptance does not establish final name clearance.

The team is configured for both app and UI-test Debug/Release targets. Team ID is a public signing identifier, not a certificate or upload credential. Existing CI builds intentionally disable signing. This change does not create a certificate, provisioning profile or TestFlight upload.

## Account Holder steps

1. Reuse the existing explicit App ID `uk.co.tenaciouspl.lifeadmin` in Apple Developer. Its internal description does not need to match the public name. Do not register a replacement identifier. No additional service capabilities are needed for this first build; calendar access uses operating-system permission descriptions.
2. In App Store Connect, open the existing **HomeAdmin** record and verify the bundle ID above. Do not create a duplicate app record or change its SKU.
3. Retain the numeric Apple ID from the app record's App Information page. This differs from the Team ID and from an Apple Account email address.

## Signing and upload

The browser-based GitHub signing workflow is prepared in [PR #4](https://github.com/Tenaciousp/LifeAdmin-AI/pull/4). Real signing is still unvalidated. Follow the reviewed workflow after its required checks pass; do not bypass source checks or environment review.

[Main CI #415](https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39400139173) passed. The signing candidate still has incomplete network-capture evidence despite passing iPad functionality. [Draft PR #6](https://github.com/Tenaciousp/LifeAdmin-AI/pull/6) investigates capture delivery without relaxing the zero-drop requirement. Check current results before progressing.

The approved sequence is: resolve required failures, merge the signing workflow, complete CI on the merged source, then run the manual signed build. Record the source revision, workflow run and version/build with the signed package. Recheck App Store Connect for an unused build number immediately before upload.

A signed IPA artifact is separate from Apple upload, TestFlight processing, tester distribution and device acceptance. Prepare and verify the upload route separately after signing succeeds. No upload, tester invitation, store submission or publication is performed by this guide update.

Use the [physical-device checklist](TESTFLIGHT_DEVICE_CHECKLIST.md) after a TestFlight installation. It covers saved records, backups, calendar permissions/alerts, AI handoff and accessibility. A later numbered TestFlight build is needed for a genuine signed-update check. Keep every unexecuted check open.

[Draft PR #5](https://github.com/Tenaciousp/LifeAdmin-AI/pull/5) contains screenshot improvements. [Gallery review](STORE_GALLERY_REVIEW.md) records the reviewed iPhone candidate and remaining composition work. Simulator evidence does not establish signed-device behaviour or final store readiness.

References:
- https://developer.apple.com/help/account/identifiers/register-an-app-id/
- https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
