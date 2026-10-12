# Password recovery: release candidate

Status: implemented for review, disabled by default, not deployed or activated.

## Behaviour

- Account screen offers Forgot password and a separate new-password/confirmation screen.
- POST /api/auth/forgot-password queues work and returns the same accepted message for existing and unknown emails.
- Per-IP request/confirmation limits, a bounded queue and a persistent two-minute account cooldown limit abuse.
- Mail uses the fixed HTTPS APP_BASE_URL, authenticated implicit TLS SMTP with certificate verification and no request Host-derived links.
- The random reset token lives in a URL fragment, is captured in component memory and removed from the address bar. It is not placed in local storage or sent in navigation/referrer headers.
- Database stores SHA-256 token digests with a 30-minute expiry and account foreign key. All outstanding reset links are removed after success.
- Password change and old-session revocation happen in one transaction. Existing account identity, tasks, saved plans and paid access stay unchanged. Another account's sessions remain intact.
- Recovery does not sign the user in automatically. Return to normal sign-in with the new password.
- Reset/change email jobs use an in-memory bounded worker. No delivery durability, provider acceptance, inbox receipt or alerting pass is claimed. Restart loses queued messages; request again after the cooldown. Delivery failures do not change the password.
- The worker's token issuance participates in the existing shared backup lock. SMTP delivery occurs outside the database/backup lock.
- No real emails, customer credentials or payment activity were used during development.

## Configuration, not activated

PASSWORD_RECOVERY_ENABLED defaults to false. Activation requires approved final HTTPS application origin and privately configured SMTP_HOST, SMTP_PORT (465 by default), SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM. The sender must be approved and authenticated by the selected mail service. A contact mailbox alone is not delivery configuration. No new provider, subscription or spending is authorised by this change.

When disabled or incomplete, the API returns recovery-unavailable with support guidance; no token is created. Never enable on the promotional website or a temporary Codespace origin for production. Never commit SMTP passwords, recovery tokens or example links containing live tokens.

## Acceptance before public release

Synthetic SQLite HTTP/storage coverage checks disabled mode, identical accepted messages, rate/queue limits, digest storage, expiry, reuse, weak/mismatched passwords, concurrent different links, rollback, account isolation, sessions, preserved records and fixed-origin fragment links. Synthetic delivery tests mock SMTP.

Still required:
1. Full CI for the final application revision, including frontend type/build checks.
2. Approved sender/provider, verified delivery and failure handling/alerts; verify whether durable delivery is required before activating this in-memory worker.
3. Secure browser acceptance for email request, link opening, address-bar clearing, password confirmation, error announcements and keyboard flow.
4. Prove old sessions lose paid access and the original account regains owned access after signing in again.
5. Review PostgreSQL transactions against a real isolated PostgreSQL service if production uses PostgreSQL. SQLite tests are not PostgreSQL evidence.
6. Respect existing browser credential, provider-decline and deletion security restrictions. No alternate-interface workaround.
7. Physical iPad Safari acceptance last and explicit owner release approval.

Security reference: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
