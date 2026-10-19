# LifeAdmin first TestFlight setup

Apple membership and App Store Connect access were confirmed by the Account Holder on 19 October 2026.

| Setting | Value |
| --- | --- |
| Apple developer Team ID | C8T85FCR6R |
| App Store working title | LifeAdmin by TenaciousPL |
| App display name | LifeAdmin |
| Bundle ID | uk.co.tenaciouspl.lifeadmin |
| Platform | iOS, including supported iPad devices |
| Primary language | English (U.K.) |
| Suggested internal SKU for a new record | tenaciouspl-lifeadmin-ios |
| Version | 1.0 |
| Seller | Paul Lonergan |
| Brand | TenaciousPL |

The Account Holder reports creating the App Store Connect record under **LifeAdmin by TenaciousPL** after the plain LifeAdmin name was rejected as already used. Keep **LifeAdmin** for the app tile and **TenaciousPL** for the publisher brand. Final name clearance remains outstanding before public launch. The numeric Apple app ID has not yet been recorded here.

The team is configured for both app and UI-test Debug/Release targets. Team ID is a public signing identifier, not a certificate or upload credential. Existing CI builds intentionally disable signing. This change does not create a certificate, provisioning profile or TestFlight upload.

## Account Holder steps

1. In Apple Developer, open Certificates, Identifiers & Profiles, then Identifiers. Reuse the existing explicit App ID if present; otherwise register `uk.co.tenaciouspl.lifeadmin`, with description LifeAdmin. Do not register a wildcard or an alternative bundle ID. No additional service capabilities are needed for this first build; calendar access uses operating-system permission descriptions.
2. In App Store Connect, open the existing **LifeAdmin by TenaciousPL** record and verify its Bundle ID matches the value above. Do not create a duplicate record or change the identifier.
3. Retain the numeric Apple ID from the app record's App Information page. This differs from the Team ID and from an Apple Account email address.

## Signing and upload

Choose one secure signing route before proceeding: an Account Holder-authenticated Xcode installation on a Mac, or a separately configured CI signing environment. No authenticated Apple signing session, distribution certificate/private key, provisioning profile or App Store Connect API key is configured by this change.

On an authenticated Mac, synchronize the offline assets with `npm run sync -- ios` from `lifeadmin_build/native`, open the Xcode project, select the approved team and automatic signing, and resolve any account/profile errors. Select an unused build number for version 1.0 after checking App Store Connect. The current source value 1 has not been verified as unused in Apple. Archive for a generic iOS device, validate the signed archive, then distribute to App Store Connect for TestFlight processing. Keep the tested source revision and build number with the archive evidence.

For CI, configure signing and API credentials only through the build system's secure secret interface, with scoped access. API authentication alone is not distribution code signing. Never place passwords, private keys, certificate exports or provisioning contents in chat, repository files or build artifacts. No new paid build service is required merely to store this configuration.

No App Store release submission or public tester invitation is part of this setup. Complete the remaining CI issue, calendar permission/alert checks and signed-package privacy review before treating the build as accepted. A TestFlight upload is for controlled testing; it does not establish store readiness.

References:
- https://developer.apple.com/help/account/identifiers/register-an-app-id/
- https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
