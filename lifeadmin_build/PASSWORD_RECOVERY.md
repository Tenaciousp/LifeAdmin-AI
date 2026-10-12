# Password recovery: release candidate

Status: implemented for review, disabled by default, not deployed or activated.

## Behaviour

- Account screen offers Forgot password and a separate new-password/confirmation screen.
- POST /api/auth/forgot-password queues work and returns the same accepted message for existing and unknown emails.
- Per-IP request/confirmation limits, a bounded queue and a persistent two-minute account cooldown limit abuse.
- Mail uses the fixed HTTPS APP_BASE_URL, authenticated implicit TLS or STARTTLS SMTP with certificate verification and no request Host-derived links.
- The random reset token lives in a URL fragment, is captured in component memory and removed from the address bar. It is not placed in local storage or sent in navigation/referrer headers.
- Database stores SHA-256 token digests with a 30-minute expiry and account foreign key. All outstanding reset links are removed after success.
- Password change and old-session revocation happen in one transaction. Existing account identity, tasks, saved plans and paid access stay unchanged. Another account's sessions remain intact.
- Recovery does not sign the user in automatically. Return to normal sign-in with the new password.
- Reset/change email jobs use an in-memory bounded worker. No delivery durability, provider acceptance, inbox receipt or alerting pass is claimed. Restart loses queued messages; request again after the cooldown. Delivery failures do not change the password.
- The worker's token issuance participates in the existing shared backup lock. SMTP delivery occurs outside the database/backup lock.
- No real emails, customer credentials or payment activity were used during development.

## Configuration, not activated

PASSWORD_RECOVERY_ENABLED defaults to false. Activation requires approved final HTTPS application origin and privately configured SMTP_HOST, SMTP_SECURITY, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM. SMTP_SECURITY accepts only ssl or starttls. Use the port documented by the chosen provider: normally 465 for ssl and 587 for starttls. There is no plaintext or automatic downgrade mode; STARTTLS must succeed before authentication. The sender must be approved and authenticated by the selected mail service. A contact mailbox alone is not delivery configuration. No new provider, subscription or spending is authorised by this change.

When disabled or incomplete, the API returns recovery-unavailable with support guidance; no token is created. Never enable on the promotional website or a temporary Codespace origin for production. Never commit SMTP passwords, recovery tokens or example links containing live tokens.

## Acceptance before public release

Synthetic SQLite HTTP/storage coverage checks disabled mode, identical accepted messages, rate/queue limits, digest storage, expiry, reuse, weak/mismatched passwords, concurrent different links, rollback, account isolation, sessions, preserved records and fixed-origin fragment links. Synthetic delivery tests mock SMTP.

Still required:
1. Full CI for the final application revision, including frontend type/build checks.
2. Approved sender/provider, verified inbox delivery and operational alerting; verify whether durable delivery is required before activating this in-memory worker. Failed jobs and queue saturation now emit fixed-text warnings with no recipient, token, SMTP credential or exception detail. Warnings are not an alert subscription or proof of delivery.
3. Secure browser acceptance for email request, link opening, address-bar clearing, password confirmation, error announcements and keyboard flow.
4. Prove old sessions lose paid access and the original account regains owned access after signing in again.
5. Review PostgreSQL transactions against a real isolated PostgreSQL service if production uses PostgreSQL. SQLite tests are not PostgreSQL evidence.
6. Respect existing browser credential, provider-decline and deletion security restrictions. No alternate-interface workaround.
7. Physical iPad Safari acceptance last and explicit owner release approval.

Security reference: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

## Mailbox compatibility review, 12 October

Official Apple documentation lists smtp.mail.me.com, port 587, authenticated TLS/STARTTLS, the full iCloud address as username and an app-specific password. For an approved iCloud sender, select SMTP_SECURITY=starttls and SMTP_PORT=587. Store any app-specific password through private configuration, never chat, Git or screenshots. Protocol compatibility does not establish permission, deliverability, throughput or suitability for customer recovery mail. No mailbox was connected or email sent.

Official IONOS UK documentation lists smtp.ionos.co.uk with port 465 for SSL or 587 for STARTTLS. A forwarding address is not a sending mailbox. The purchased domain's mail DNS records do not prove a provisioned mailbox or authorise a new paid email product.

Sources:
- https://support.apple.com/en-gb/102525
- https://www.ionos.co.uk/help/index.php?id=4770

Six additional mocked delivery tests cover SSL certificate verification, STARTTLS before credentials, failed upgrades, invalid mode/port, sanitized worker failures and full-queue warnings. Real delivery and browser acceptance remain open. The previous full CI #293 validates revision e9910bdde05b28a94e5b69c337a62a0954f0e71a; this follow-up requires its own CI result.
