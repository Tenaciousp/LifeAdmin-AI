# Contract diary and preferred AI questions

Implementation added 19 October 2026. Pending native runtime acceptance; no release-quality or calendar-delivery claim follows from the JavaScript tests.

## Customer behaviour

Contract expiry, renewal, cancellation-notice and follow-up dates are separate from ordinary payment dates. Each bill opts in. After the customer grants calendar permission and selects a writable calendar, the app reconciles linked entries on save, changes to records and reopening. Done/deleted/disabled bills remove linked entries. Restoring a backup changes the desired entries on a connected device. Past dates do not create new events. Lead times are on the day, 7, 14 or 30 days; alerts depend on the calendar provider and device settings.

Calendar entries use neutral titles and no bill references or provider names. Calendar providers may synchronize or share those dates. iOS needs full EventKit access to maintain existing entries; Android needs read/write calendar permission. No permission request occurs just for saving a bill. Only installation-marked events are modified. Disconnect either keeps entries or removes managed entries. Uninstall does not guarantee calendar cleanup. Connections are device-specific and excluded from exported bill backups; two connected devices can create duplicate entries in a shared calendar.

AI actions include reviewing next steps, letters/emails, renewal negotiation, cancellation/switching, complaints and alternative-offer research. Users select known details and optionally include the saved message. Account references, unstructured detail fields and the saved message are excluded by default. The final question is editable. A device-specific preferred service is remembered separately from bill backups. The app does not upload the prompt or attach it to an external URL: copy, open and paste remain deliberate actions. The user's existing free/paid AI account governs access. Returned text is pasted into the message editor and saved manually.

Comparison questions request location/requirements, current sources, checked dates and total contract costs. They require the AI to disclose missing live-research access. They are not a verified comparison service or guaranteed savings.

## Verification

Local JavaScript tests cover prompt field selection, nonmutation, research instructions, unsupported service/task inputs, preference persistence/failure, strict dates and leap years, stable entry keys, removal intent and backup round trips. Native configuration checks cover registrations, calendar permission descriptions and the UserDefaults required-reason declaration. CI builds both native adapters and runs offline tests explicitly.

## Outstanding native acceptance

- [ ] iOS 16.4 legacy and iOS 17+ full-access permission paths; denied and revoked permission; no writable calendar.
- [ ] Android permission grant/deny/revoke and provider availability.
- [ ] Create four dated entries, save repeatedly, restart, edit each date and verify one corresponding entry per type.
- [ ] Cross a daylight-saving boundary and change the device time zone. Verify all-day dates and actual alert behaviour; Android provider alert timing differs from iOS absolute 09:00 alerts.
- [ ] Mark done, delete, disable, restore a backup and switch calendars; inspect creation/removal and unrelated events.
- [ ] Disconnect with keep/remove choices, retry a failed removal and test an externally removed or moved event.
- [ ] Interrupt provider writes and restart; verify marker-based recovery without duplicates.
- [ ] Preferred AI persists after restart; select another service; select/exclude a reference; edit and copy a prepared question; cancel/retry copying. No external AI submission is needed for automated tests.
- [ ] Paste a synthetic response into Edit message, save and verify restart/backup restoration.
- [ ] VoiceOver, larger text, keyboard and portrait/landscape access to the new controls.
- [ ] Review final privacy policy, store questionnaires and signed-package manifests for optional calendar-provider sharing before distribution. Public marketing must not claim these pending features are validated.

No new AI subscription, backend calendar service, live pricing API or paid infrastructure was introduced.
