# HomeAdmin signing through GitHub Mac runners

Selected by the Account Holder on 19 October 2026.

## Verified signing result, 21 October 2026

The release-specific workflow `.github/workflows/apple-signing-recovery.yml`
successfully archived, signed and exported HomeAdmin 1.0 build 1 in
[run 39619888350](https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39619888350).
The app source is `42755483eeea11581bc2e89530eb9f6974e8ff17`, which passed
all eight full CI jobs. Archive and exported-app signature and entitlement
checks passed. Signed artifact 12355587018 expires on 28 October 2026.

The recovery runs on `macos-26-intel`, imports the existing signing identity
through a temporary macOS-compatible P12 copy, and matches the profile name,
raw UUID and certificate fingerprint. Temporary signing files are removed.
The protected `apple-signing` environment remains restricted to main with
owner review and no administrator bypass.

For this release, use the verified recovery artifact and
[TESTFLIGHT_UPLOAD.md](TESTFLIGHT_UPLOAD.md). The generic workflow documented
below has not completed a successful real-credential signing run and is not the
verified release path. A signed IPA does not establish Apple upload, processing,
TestFlight availability or physical-device acceptance.

## Prepared workflow

`.github/workflows/apple-signing.yml` is manual, restricted to main, and requires
a successful full HomeAdmin CI run for the exact source. It uses environment
`apple-signing`, the existing standard `macos-26` runner and an owner-supplied
unused build number. No push/PR event, Apple upload or public release is included.
The workflow must be reviewed and merged to the default branch before use;
merge remains a separate owner decision. Review Actions usage before dispatch.

It installs a private distribution identity in a temporary keychain, validates
the profile's team, explicit bundle ID, expiry and distribution type, and changes
only the runner checkout's app Release signing/build-number settings. App ID,
storage, version-1 backup compatibility and customer source remain unchanged.
It verifies the exported IPA's signature and team/app entitlements, then retains
the IPA and source/build evidence for seven days. Certificates, profile contents
and the keychain are excluded from uploaded artifacts and cleaned up on exit.

This workflow has not run on macOS with real credentials. Local validation does
not establish successful Apple signing or TestFlight processing.

## Credentials to prepare privately

Create a GitHub environment named `apple-signing` in this repository. Restrict its
deployment branches to main and configure owner review where supported.

| Environment secret | Required content |
| --- | --- |
| `APPLE_DISTRIBUTION_P12_BASE64` | Base64 of the Apple Distribution certificate **with its matching private key**, exported as password-protected P12 |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | P12 export password |
| `APPLE_APPSTORE_PROFILE_BASE64` | Base64 of the App Store Connect distribution provisioning profile for `uk.co.tenaciouspl.lifeadmin`, Team `C8T85FCR6R`, containing that certificate |

The Team ID and downloaded public `.cer` alone are insufficient. Do not send
private keys, P12 files, passwords or provisioning contents through chat, issues
or repository files. No App Store Connect API key is needed for this build-only
workflow. Upload authentication will be configured separately.

## If no distribution identity exists yet

The Apple Account Holder creates an Apple Distribution certificate in
Certificates, Identifiers & Profiles, using a certificate-signing request (CSR).
Keep the matching private key. Then create an App Store Connect distribution
profile for the existing App ID and new certificate. Do not register another
app or bundle identifier, and do not revoke existing certificates to make room
without reviewing their users first.

A CSR and P12 can be prepared using OpenSSL on a trusted computer or an existing
private development terminal; a local Mac is not required for these file steps.
Example for a trusted terminal, outside the repository:

```bash
umask 077
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -aes-256-cbc -out homeadmin-signing.key
openssl req -new -key homeadmin-signing.key \
  -out homeadmin-signing.csr -subj '/CN=Paul Lonergan'
```

OpenSSL asks for a private-key password. Upload only the CSR to Apple. Download
the resulting public certificate to that same trusted location, then:

```bash
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey homeadmin-signing.key \
  -in distribution.pem -out homeadmin-distribution.p12
```

Keep the encrypted private key, P12 and passwords in the owner's secure custody.
The filename `distribution.cer` is illustrative; use the actual downloaded file.
Configure the three secrets directly in GitHub's environment secret interface
or with an authenticated GitHub CLI reading local files, never via a PR.
No new paid development environment is authorised by this guide.

## Execution and next gate

After review/merge, green CI and credential setup, verify an unused version-1.0
build number in App Store Connect, then manually run HomeAdmin manual signed
build on main. Inspect its source/build evidence and signed-package privacy
details. A generated IPA is not directly installable through Files on an iPad.
Uploading to App Store Connect, processing, TestFlight installation and device
acceptance are subsequent steps and are not claimed complete here.

References:
- https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications
- https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/
- https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/
