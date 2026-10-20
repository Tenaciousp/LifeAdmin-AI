# Network capture follow-up

19 October 2026. Prepared tooling change; native verification is pending.

CI #412's iPad application test command exited zero. Downloaded reports cover
accessibility, startup/relaunch, exact backup restoration, message editing,
manual AI handoff, clipboard, rotation and storage recovery. Both upgrade jobs
and both screenshot jobs also passed. This does not clear network privacy.

The iPhone full suite passed its initial accessibility and backup/persistence
stages, then failed in the rotation helper. It asked XCTest for the hittability
of Next Steps while that heading was above the landscape viewport (y = -9).
XCTest raised an invalid activation-point error before the helper could scroll
down. Geometry was checked second in the short-circuit condition. The follow-up
checks nonempty frame and viewport containment first, then invokes the same
native hit test. Small static-text labels must be fully inside the viewport;
their centre alone can fall inside while the glyph remains clipped. A downward
correction uses a bounded native drag proportional to the distance above the
viewport instead of a full swipe that overshoots. The 14-scroll limit, rotation
checks, screenshots and record assertions remain unchanged. The new run must
verify the full rotation journey.

The overall iPad job failed correctly: capture reported 11,131 kernel drops,
1,072,095 packets received by the filter, 1,060,962 metadata-filter drops and
only the two synthetic control packets retained. Dropped packets are unknown;
do not infer they were unrelated runner traffic or classify app traffic as zero.

Apple tcpdump's metadata filter is evaluated in user space, so unrelated
traffic still creates capture-buffer pressure before being discarded. The
follow-up requests a 64 MiB buffer instead of 16 MiB and records the kernel's
published buffer ceiling when available. This is a capacity experiment, not a
verified root-cause repair. The ceiling is not a measurement of actual allocation.

All interfaces, BPF traffic coverage, 512-byte snapshot length, App/effective-App
attribution, control verification and zero-kernel-drop requirement are unchanged.
No payload capture file or unrelated process metadata is saved. WebKit traffic
without App attribution and excluded loopback traffic remain outside this scope.
Final signed-package and physical-device privacy review remain outstanding.

Source references:
- https://github.com/apple-oss-distributions/tcpdump/blob/main/tcpdump/tcpdump.c
- https://github.com/apple-oss-distributions/xnu/blob/main/bsd/net/bpf.c


## 20 October: CI #422 diagnostic repair

The allocated buffer was measured at 33,554,432 bytes. All 34,923 kernel drops
were already present before the first accessibility test; the counter did not
increase during the app test stages. The isolated four-cycle keyboard test
passed, but the following freshly reinstalled backup test again exhausted its
unchanged 900-second limit in animation-idle waits. The iPad upgrade failed
before a later test could start because SpringBoard reported the test runner
still installing/uninstalling. No app assertion established data loss.

The full simulator script now starts capture only after initial boot/install,
before any app launch. Preflight accessibility/keyboard tests and the full
acceptance journey have separate control-verified capture segments, each with
the zero-drop gate. Simulator preparation and the intervening OS restart are
outside capture; no customer-app workflow executes during that gap. Both
network-capture-preflight.json and network-capture.json must pass. Packet and
log files retain the same suffix scheme. Per-stage counters remain available.

After the iPad keyboard test and fresh reinstall, restart the disposable OS
before the backup journey. Restart the iPad upgrade simulator before each
candidate test session without uninstalling, reseeding or replacing app data;
compare the original exported records again before testing. These changes do
not retry failed app tests, bypass native idle synchronization or extend limits.
They require fresh macOS execution before signing. Zero loss in the shorter
#421 preflight run did not establish completeness for the full journey.
