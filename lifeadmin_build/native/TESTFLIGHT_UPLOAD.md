# HomeAdmin TestFlight upload

## Verified release candidate, 21 October 2026

HomeAdmin version 1.0 build 1 was signed and exported successfully in run
39619888350. The tested app source is
`42755483eeea11581bc2e89530eb9f6974e8ff17`. The profile includes the imported
valid signing identity. Archive and exported IPA signature/entitlement checks
passed. Artifact 12355587018 is retained until 28 October 2026.

## Protected upload workflow

`.github/workflows/apple-testflight-upload.yml` uploads that existing signed
IPA without rebuilding. The main-only workflow uses owner-reviewed environment
`apple-signing`, verifies the successful signing run and exact IPA SHA-256,
checks the app/team/version/build and signature again, then validates with Apple.
The default action is `validate`, which performs no upload. Selecting `upload`
validates first and then uploads for Apple processing. No automatic retry,
tester invitations or App Store review submission is included.

Upload accepted by altool does not establish successful Apple processing or
TestFlight availability. Check the build's processing and compliance state in
App Store Connect before adding the owner as an internal tester. Internal beta
installation and physical-device acceptance remain separate gates. Do not reuse
build 1 for different binary bytes or retry an upload without checking whether
Apple already accepted the build.

## Owner setup on iPad

Use the Apple Account associated with App Store Connect. In
https://account.apple.com choose Sign-In and Security, App-Specific Passwords,
and generate a password labelled HomeAdmin TestFlight. Enter and submit any
new credential privately yourself. Do not place credentials in chat or source.

In GitHub repository Settings, Environments, apple-signing, add these
**environment** secrets while preserving the existing signing secrets:

| Name | Value |
| --- | --- |
| `APPLE_UPLOAD_APPLE_ID` | Apple Account sign-in email used for App Store Connect |
| `APPLE_UPLOAD_APP_PASSWORD` | New HomeAdmin TestFlight app-specific password |

The app-specific password differs from both the regular Apple Account password
and the P12 export password. Existing GitHub environment protection stays in
place. The credential is supplied through altool's environment-variable password
reference rather than a literal password command argument. No API key or new
provider connection is required by this route.

After both secrets are saved, manually dispatch the upload workflow on main,
select action `upload`, and review/approve the protected job. Inspect the result
and App Store Connect processing status. If Apple presents legal terms, the
Account Holder must review and accept those terms personally.

## Validation performed before dispatch

Workflow YAML, shell and embedded Python syntax checks passed. The existing
artifact digest, IPA hash, build evidence, bundle/version/build and signature
resources were independently checked after download. Apple validation and upload both succeeded in
[run 39666509617](https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39666509617)
on 21 October 2026. Apple accepted HomeAdmin 1.0 build 1 for processing.
The uploaded build is now visible in App Store Connect TestFlight as version
1.0 build 1, build ID `f498df6a-b171-41c5-9cd8-5c434eda1277`.
Its observed status is **Missing Compliance**. The encryption questionnaire
answer is prepared but has not been submitted; explicit owner approval is
required for the regulatory declaration. Internal testing and installability
are not yet verified. No tester invitations or App Store review submission
were performed.

The upload runner uses the current altool interface: positional IPA path,
`--platform ios`, explicit bundle/version/build metadata and
`--app-password @env:APPLE_UPLOAD_APP_PASSWORD`. The separate offline
`diagnose` action reports fixed format/whitespace checks without authenticating.
Apple error `-22938` requires a valid generated app-specific password for the
Apple Account stored in `APPLE_UPLOAD_APPLE_ID`. Password format alone does
not establish valid authentication.

A temporary owner-approved encrypted error diagnostic identified the earlier
authentication failure. The diagnostic artifact expires after one day; the
temporary response capture was removed from the workflow afterward. Raw Apple
responses and credentials are not printed in public logs.

References:
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- https://help.apple.com/asc/appsaltool/en.lproj/static.html
- https://support.apple.com/en-us/102654

## Encryption review for uploaded build 1

Review used the exact signed source `42755483eeea11581bc2e89530eb9f6974e8ff17`
and the previously verified IPA. The local native app exports readable JSON
backups; its Swift storage and file plugins use Apple's file protection.
Native dependencies are Capacitor/Cordova 8.5.3. The five shipped JavaScript
files contained none of the checked standalone encryption markers
(`crypto.subtle`, AES-GCM/AES-CBC, PBKDF2, CryptoJS, tweetnacl, libsodium,
or node:crypto). This marker check supports the source review; it is not a
standalone proof of every binary dependency.

The reviewed questionnaire answer is **None of the algorithms mentioned above**,
because no app-level implementation beyond Apple's operating-system facilities
was identified. Apple states that encryption limited to its operating system
requires no encryption documentation in App Store Connect:
https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption

The answer must be reviewed again if the app or its dependencies change their
encryption behavior. No signed build was modified during this review.
