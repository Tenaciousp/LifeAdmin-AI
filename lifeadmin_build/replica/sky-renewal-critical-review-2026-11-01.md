# Critical journey review: Sky renewal case

User-reported blocker: entering a Sky renewal request did not produce an understandable plan or clear provider alternatives. This is a P1 usability/product-value failure even when synthetic CI is green.

## Code findings
- BillHelp currently requires four stages and manual AI transfer for the preferred Copilot route. It does not itself research or return current offers.
- The offline path uses generic templates, not verified renewal research.
- The external-AI plan prompt requests like-for-like comparisons, contract total, exit fees, official sources and dates, but the product itself cannot guarantee those sources or verify accuracy.
- Field-by-field disclosure, provider-message paste, return-to-app and review controls make the first-use journey cumbersome.
- Synthetic tests confirm UI mechanics, not successful actual Sky price comparisons or a satisfactory completed letter.

## Required acceptance scenarios
1. Enter Sky television/broadband renewal, existing price, contract end date, package/usage and postcode area; preserve all entered details.
2. Generate a plan through an available AI provider with a tailored retention call script, price benchmark research checklist, stay-versus-switch comparison and missing information flagged.
3. Offer an editable renewal email with request for itemised retention quote, contract length and fees, no fabricated prices.
4. Paste Sky's reply, prepare a coherent reply, save and resume without data loss.
5. Explain Copilot copy/paste handoff before any claim of automatic generation.
6. Accessibility, narrow screen, iPad restart, offline recovery and data-backup checks; real-world beginner acceptance is mandatory.

## Safeguards
Do not claim automatic live deal lookup or fully integrated AI while free external-AI handoff is the default. Do not invent market offers or guarantee savings. Keep local-first storage, no sign-in, optional AI choice, existing saved plans, water/energy separation, and no deployment.

## Current change
A contextual renewal starting point is now offered for television/broadband plans. This is a first repair, **not** full resolution of the blocker. The 9/10 readiness claim is suspended pending real acceptance.
