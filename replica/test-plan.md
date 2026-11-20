# HomeAdmin Build 4: end-to-end customer journey audit
Date: 2026-11-17. Baseline: main commit 55a86b53b73e8751a76ed3366a4f7dce6f37d2ce, HomeAdmin 1.0 (4).

## Evidence
- Main-branch CI 43911405887: 8/8 jobs passed on iPhone/iPad, upgrade, browser and archive checks.
- Signing workflow 43965759778: successful. Log states: "No in-app AI endpoint configured; chosen AI and offline drafts remain available."
- Upload workflow 43973061862: Apple validation and upload accepted for processing.
- Reviewed Build 4 source: LocalApp.tsx, BillHelp.tsx, BillOverview.tsx, PlanResultSummary.tsx, PlanEmailEditor.tsx, ComparisonWorksheet.tsx, DiaryPanel.tsx, SavedResults.tsx and offline modules.
- This document reports source inspection and CI results, NOT a manual walk-through of the installed TestFlight binary or live provider comparisons.

## Step-by-step customer acceptance cases
Mark PASS, FAIL, or NOT RUN per case with device, OS, steps, expected/actual result and screenshot or log evidence.

| ID | Journey | Happy path | Critical edge cases |
|---|---|---|---|
| F01 | First launch | Open, read Start here, add bill without sign-in | Empty records, slow storage, relaunch, iPad text |
| F02 | Bill entry | Select category/type/goal, enter provider/cost/frequency, save | Required fields, dates, duplicate tap, unsaved changes |
| F03 | Combined energy | Save dual fuel and retain identity/usage across edits and restart | Missing kWh/rates, standing charge, DD vs actual cost |
| F04 | Bill navigation | Browse/search/filter/sort/edit/mark done/reopen/delete | No results, multiple currencies, cancelling delete |
| F05 | AI setup | Saved bill > Create plan or message > goal > method | Plan/letter/reply switching, back navigation, resume |
| F06 | Copilot handoff | Copy prompt > open Copilot > return with answer > paste | Clipboard failure, app suspension/restart, empty AI answer |
| F07 | Direct Gemini | Consent > generate > review/edit, only when configured | Offline, no consent, 429/503, timeout, malformed response |
| F08 | Comparison | View current cost, alternatives, savings evidence, next action | Unexpected AI headings, missing sources, incompatible prices |
| F09 | Provider email | Edit subject and body > copy > manually send | Missing email in AI output, blank fields, leftover placeholders |
| F10 | Saved result | Confirm review > save > reopen > edit/copy > restart | Double-save, edit old plan, delete one result |
| F11 | Calendar reminders | Add date > enable calendar > confirm alert | Permissions, DST, disconnect/remove, app closed |
| F12 | Backup/restore | Export > confirm backup > restore > match saved data | Cancel, corrupted file, >5 MB, interrupted write |
| F13 | Accessibility | Repeat journeys with VoiceOver, large text, rotation | Focus, clipping, keyboard overlays, long text |
| F14 | Native upgrade | Install Build 4 over Build 3 > verify bills, plans, drafts | Cold restart and incompatible version recovery |

## Findings and priorities (not independently reproduced device bugs)
- P0: **Central AI promise is incomplete.** The signed Build 4 has no in-app AI endpoint configured. Copilot or another external AI requires manually copying the question, switching apps, copying the answer back, then reviewing and saving. Source: signing log, BillHelp.tsx and ai-generation.mjs.
- P1: **Live offers are not independently verified by the shown result path.** PlanResultSummary.tsx presents AI text and caveats; ComparisonWorksheet.tsx accepts customer-checked offers. Savings must remain labelled illustrative until equivalent official prices, eligibility, dates and fees are checked.
- P1: **Multi-app handoff friction.** Verify all return-to-app and saved-draft steps with novice users on an actual iPhone and iPad.
- P2: **AI headings are brittle.** PlanResultSummary.tsx extracts limited Markdown headings; a valid response using alternative headings can fall back to warnings.
- P2: **Step-one wording conflicts with choice UI.** BillHelp.tsx says AI choice is not required yet but immediately shows its method selector.
- P2: **Long first-launch page.** LocalApp.tsx presents several sections; confirm on-device discoverability and progressive navigation.
- P2: **Calendar scope.** DiaryPanel.tsx updates when app is active/reopened, while alerts depend on the device calendar; avoid implying a background reminders engine.

## Protection and exit gates
Preserve local records, no mandatory sign-in, existing plans and drafts, dual fuel, Copilot preference, privacy controls and existing Build 4. Do not merge untested changes. Run all F01-F14 on physical TestFlight devices before claiming complete 9/10 user journey. Write reproduced bugs with steps and evidence in replica/bugs.md. Fix S1/S2 first with regression tests, run complete CI and native upgrades before the next signed build.
