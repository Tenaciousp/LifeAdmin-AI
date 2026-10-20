# HomeAdmin Apple startup and accessibility repair

19 October 2026. Candidate repair; native validation is pending.

## Evidence from CI 411

Source `fdf37233659d07f8019ba9aee9ab8cca19add5fc`, tested merge
`a46c92c44392a7f9693f8ee8ab8150efadc1f95a`.
Run: https://github.com/Tenaciousp/LifeAdmin-AI/actions/runs/39282398097

Five of eight jobs passed, including both store-preview jobs, Android/verification,
the unsigned device archive and iPad upgrade. The notification screenshot predates
some final job outcomes; use the completed run for status.

- iPad full suite: the first accessibility audit found potentially inaccessible
  text. The header logo contains the HomeAdmin wordmark but had an empty alt
  attribute. The remaining five sampled stages added no further findings.
- iPhone full suite: Search never appeared within the existing 60-second
  allowance. The screen and hierarchy showed a blank WebView. WebKit system logs
  show startup and resource processing but do not establish a single root cause.
- iPhone upgrade: the baseline exported acknowledged records and the candidate
  installed without uninstalling. Candidate Search existed in the accessibility
  tree, but Mark done stayed off-screen after 14 swipes. The saved screenshot was
  blank despite a populated hierarchy. This does not prove lost records.
- iPhone network capture additionally reported 6,368 kernel-dropped packets.
  That capture is incomplete and provides no zero-network/privacy clearance.

## Repair

Give the native header wordmark the accessible name `HomeAdmin logo` and assert
its presence in the existing native accessibility test. Retain every audit type
and the aggregate requirement for zero findings.

Move the safe-area container setup into `capacitorDidLoad`, before the inherited
`viewDidLoad` starts navigation. Previously the app called super.viewDidLoad
(which starts loading) and then replaced the root view and reparented WebKit.
The earlier setup removes that lifecycle race while preserving safe-area
constraints, plugins, navigation delegate and the single initial page load.
This is a targeted correction, not a proven explanation of every simulator stall.

Framework lifecycle reviewed against the pinned version:
https://github.com/ionic-team/capacitor/blob/8.5.3/ios/Capacitor/Capacitor/CAPBridgeViewController.swift

No automatic reload, retry, time-limit increase or skipped assertion is added.
Cold launch, scrolling, restart persistence, both upgrades, six accessibility
stages and screenshot jobs must pass again. Network capture completeness and
signed/physical-device acceptance remain separate requirements.
