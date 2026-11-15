# Build 4 beginner-first acceptance and review plan
Date: 2026-11-15. Scope: user-provided TestFlight Build 3 feedback and source review. This is a **test plan**, not a claim that human/device tests passed.

## Preserve
- HomeAdmin / TenaciousPL, one-time paid distribution, no required accounts.
- Existing saved household records, imported backups, linked results, native calendar integration and local storage.
- Combined gas and electricity, separate water and energy categories, selected external AI (Copilot default), optional direct Gemini only where configured and healthy.
- User approval before sending information externally, honesty about unverified supplier offers, editable plan and letter, no automatic provider correspondence.

## Critical customer journey
B01: Starting from a fresh HomeAdmin install, customer must see **Start here** and understand:
1. Add one household bill or subscription using their own saved details.
2. Select a saved bill and ask for help; choose save money, query a bill or prepare a provider message.
3. Choose the available AI route, with plain-language instructions for copying into Copilot or another AI when native direct generation is unavailable.
4. Review the AI answer; distinguish real provider sources and dates from estimated savings and unverified suggestions; save editable text.
5. Reopen the saved result, copy the letter, set a follow-up reminder and verify the app has not sent anything.

## Acceptance cases (must be tested before Build 4 signing)
- B01-H1: First-launch 390px and tablet view; three steps visible; add bill action scrolls to entry and opens form.
- B01-H2: Existing bills show a clear path to the right bill without needing to understand the Plans tab.
- B01-H3: User chooses a primary outcome; other goals remain available under More ways to get help; selected state visible.
- B01-H4: External AI instructions clearly explain copy, paste, return and save; no account access or silent sending.
- B01-H5: Existing plans and draft progress persist through app restart and upgrade, with accurate bill association.
- B01-H6: Combined gas/electricity example preserves both fuel details, dates, monthly cost and letter context.
- B01-H7: Saved result page explains Open/Delete; deletion confirms scope and does not remove unrelated records.
- B01-H8: Diary explains how to add dates and connect a calendar, with clear permission requirements and no promise of automatic reminders without configuration.
- B01-E1: Slow/unavailable in-app Gemini reveals an available external AI or offline route; no user-entered information lost.
- B01-E2: AI suggests an unverified supplier price; interface must mark this unverified and request a dated official source before claiming savings.
- B01-E3: Cancel bill deletion, then verify bill and related results survive.
- B01-E4: Keyboard, VoiceOver, 200% text size, landscape iPad and narrow mobile layouts; controls reachable and labels meaningful.
- B01-E5: Missing or conflicting bill amounts and different billing frequencies trigger review before comparison.
- B01-E6: Multiple-currency bills do not combine values as a single total.
- B01-E7: Check first-time user understanding by asking them to explain the next action at every step without coaching.

## Release gates
- PR #26 visible bill actions, PR #27 focused outcome choices and PR #28 beginner guidance need verified CI and an integration check for duplicate UI copy.
- Run frontend typecheck/build, offline data tests, synthetic browser tests and native iPhone/iPad upgrade tests on the **combined revision**.
- New code must not overwrite or silently migrate local records. Verify no customer data sent without action.
- No 9/10 rating until observed first-time user completion and actual native AI testing. Retain Build 3 as baseline.
