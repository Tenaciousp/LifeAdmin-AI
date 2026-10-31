# Live AI acceptance gate

Prepared 2026-10-29. All cases use invented facts. None has been run against a live model yet. A synthetic API response or a configured key is not a passed live case.

## Preconditions

Confirm the publisher's Gemini project is billing-enabled for the UK deployment and agree an operating budget before enabling billable generation. Publish the reviewed privacy notice, verify the intended Render service/commit and usage controls, then configure the native build's HTTPS AI API origin. Confirm maintenance settings and backend health. Never place a provider key in the client or include real customer records in testing.

The current process-local daily request counter is a usage safeguard, not a guaranteed monthly spending cap. Billing alerts alone are not proof of a hard stop. Confirm budget enforcement and restart/multi-instance behaviour before public paid API access.

## Synthetic cases and human review

|Case|Supplied facts and task|Required result|Reject if|
|---|---|---|---|
|Energy plan|UK; Example Energy; GBP80 monthly; 2400kWh/year; renewal 1 March 2027; ask for a renewal plan|Consistent supplied facts, short action list, explained next steps and offer research checklist when current offers are unverified|Invented savings/prices/availability, accepted switch or changed dates/amounts|
|Water plan|Ontario, Canada; Example Water; CAD45 monthly; metered; estimated reading|Local context, reading/billing questions, relevant support or tariff checks|UK-specific rights presented as Canadian rules, unsupported household-water supplier switching|
|Provider letter|UK broadband; GBP29 current, GBP36 proposed; contract end unknown; ask to explain increase|Separate subject/body, clear factual request, placeholders for missing identity, no automatic sending|Invented contact address, invented deadline/right or agreement to a new contract|
|Provider reply|Message says an estimated charge needs an actual reading; actual reading/date unknown|Answer the message, identify missing reading/date, request clarification without admitting liability or accepting an offer|Fabricated reading, invented payment history or accepted liability|
|Missing/conflicting facts|Amount labelled EUR60 monthly; note says GBP60 quarterly; country and provider unknown|Flag the conflict and ask for clarification before estimating costs or recommending a specific offer|Silent correction, mixed-currency total or confident supplier recommendation|
|Service recovery|Unavailable/rate-limited service after explicit consent|Preserve the reviewed request; chosen-AI/offline alternatives; fresh consent on returning to in-app generation|Automatic retries/sending, lost text or a result saved without review|

Run plan, letter and reply through the actual app path, not only the endpoint. Record time to answer, model/service identity, request/response shape, factual consistency, clarity, missing-fact handling, source verification and whether the review/save step preserves the bill. Check reopening, background/return and unavailable connectivity on signed iPhone/iPad builds.

Google search grounding is not configured in the current proxy. Do not label model output as a live provider-price comparison. Current offers and links require independent verification.

## Overall quality decision

These cases contribute evidence for AI usefulness, which is 20% of the agreed app assessment. Presentation, ease, functionality, reliability/accessibility and value still need their own evidence. No overall 9/10 score follows from passing these cases alone. Keep beginner and installed-device acceptance distinct from browser mocks and simulator CI.
