# Network capture follow-up

19 October 2026. Prepared tooling change; native verification is pending.

CI #412's iPad application test command exited zero. Downloaded reports cover
accessibility, startup/relaunch, exact backup restoration, message editing,
manual AI handoff, clipboard, rotation and storage recovery. Both upgrade jobs
and both screenshot jobs also passed. This does not clear network privacy.

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
