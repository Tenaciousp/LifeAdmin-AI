# HomeAdmin competitive UX revision

Reviewed 22 October 2026. Target: a credible household administration product,
not a generic form and not an unverified claim of financial-service parity.
Adopt common interaction patterns; retain original HomeAdmin branding and copy.

## Official product benchmarks

| Reference | Useful pattern | HomeAdmin implementation in this revision |
| --- | --- | --- |
| [Monarch](https://www.monarch.com/features/tracking) | Overview plus recurring bills in list/calendar views | Household overview, upcoming entered dates, separate monthly/annual currency totals, direct bill editing. Full calendar-grid view remains a gap. |
| [Snoop](https://www.snoop.app/how-it-works/) | Bill cards, categories, contract dates, relevant actions | Bill cards, active/completed filters, saved-bill search, service subtypes, planning and diary access. No claim of automatic transaction analysis or live deals. |
| [TimelyBills](https://www.timelybills.app/) | Recurring-bill organisation, reminders and international currency support | Explicit amount/currency/frequency, platform-supported currency codes, country and local-area context. Existing permission-based calendar integration remains separate from payment dates. |
| [Rocket Money](https://www.rocketmoney.com/faq) | Subscription visibility and a clear financial overview | Dedicated subscription service choices and recurring-cost visibility. No claim of bank discovery, negotiated savings or account cancellation. |

## Included

- Dark overview hero, clear summary cards, actionable empty states, navigation
  shortcuts and quick category entry. No new application dependency.
- Energy and water stay separate. Water has metering, usage/leaks, charging,
  support and company-query options. No household water supplier-switch promise.
- Internet/mobile/TV, subscriptions, housing, health, childcare, transport and
  home services have service-specific choices within compatible category IDs.
- Per-bill country, currency, recurrence and next payment date. Other territories
  have a free-text country field. International water uses local-area wording.
- Monthly and annual cost estimates only use explicit numeric amounts, currency
  and recurrence. Weekly=52 payments/year, fortnightly=26, four-weekly=13.
  One-off, unknown and ambiguous legacy amounts are excluded with an explanation.
- Currencies never merge without conversion. No invented exchange rates.
- Overseas bills use conservative provider-query guidance rather than UK legal
  playbooks. Country, currency and service context join the opt-in AI handoff.
- Existing records and readable backup schema remain compatible. Completing a
  task does not claim a payment has been made or a subscription cancelled.

## Release gates and remaining competitive gaps

- Offline unit/regression tests, type check, local production build, browser
  responsive scenarios, native simulator persistence and upgrade checks.
- Review saved-bill entry, action specificity, keyboard behaviour, VoiceOver,
  large text, portrait/landscape and real-device comfort before a quality rating.
- This revision is English-language international groundwork, not full global
  localisation. Country-specific legal rights, provider directories and support
  schemes need jurisdiction-by-jurisdiction review.
- Dedicated app panels rather than page shortcuts, calendar-grid view, payment
  history, spending budgets, document import/OCR and richer analytics remain gaps.
- Bank linking, automatic discovery, cloud household sharing and automatic
  provider actions require separate security, consent and service architecture.
  They are not represented by non-functional controls.
- The installed TestFlight 1.0 (1) remains unchanged until a new tested, signed
  build is explicitly produced and uploaded through the protected release path.

## Browser evidence

`scripts/qa_bill_experience.cjs` exercises Canadian metered water entry,
CAD monthly forecasts, saved-detail reload persistence, and 390/768/1024px
layouts. CI installs an isolated Playwright QA dependency and retains synthetic
screenshots for seven days. This is complementary to native iOS tests, not a
replacement for a device usability review.
