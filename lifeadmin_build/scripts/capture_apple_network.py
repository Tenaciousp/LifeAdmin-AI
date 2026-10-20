"""Record packet metadata during synthetic Apple simulator acceptance.

macOS CI only. No packet payload file or HTTP body/header dump is saved.
Only App-attributed traffic and this synthetic control process are retained.
"""
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time


def capture_snapshot(evidence, stage):
    """Record only this recorder's BPF counters, never other process rows.

    Apple's netstat Bsize is the allocated bd_bufsize; RDrop is cumulative.
    https://github.com/apple-oss-distributions/network_cmds/blob/main/netstat.tproj/bpf.c
    """
    pidfile = evidence / "network-capture.pid"
    if not pidfile.exists():
        return  # Upgrade/screenshot harnesses also use run_ui_test without capture.
    pid = pidfile.read_text().strip()
    sample = {"stage": stage, "at_unix": time.time(), "capture_pid": pid}
    try:
        result = subprocess.run(["sudo", "-n", "/usr/sbin/netstat", "-B"],
                                capture_output=True, text=True, timeout=10, check=False)
        lines = result.stdout.splitlines()
        sample["netstat_exit_code"] = result.returncode
        sample["bpf_devices"] = [dict(zip(lines[0].split(), line.split()))
                                 for line in lines[1:]
                                 if line.split() and line.split()[-1] == "tcpdump." + pid]
        # An unavailable counter is unknown, never evidence of zero drops.
        sample["allocation_observed"] = bool(sample["bpf_devices"])
    except (OSError, subprocess.TimeoutExpired) as error:
        sample["counter_error"] = type(error).__name__
        sample["allocation_observed"] = False
    with (evidence / "network-stages.jsonl").open("a") as output:
        output.write(json.dumps(sample) + "\n")


def main():
    command = sys.argv[1:]
    if command[:1] == ["--"]:
        command = command[1:]
    if sys.platform != "darwin" or not command:
        raise SystemExit("Requires macOS and a test command after --")
    evidence = Path("apple-launch-evidence")
    evidence.mkdir(exist_ok=True)
    packets = evidence / "network-packets.txt"
    diagnostic = evidence / "network-capture.log"
    pidfile = evidence / "network-capture.pid"
    pidfile.unlink(missing_ok=True)
    report = {
        "scope": "Packet metadata attributed to App plus the synthetic control process; not signed-device or payload inspection",
        "manual_process_attribution_required": True,
        "attribution_limit": "Loopback traffic except the control, and WebKit traffic without App effective-process attribution, are outside this capture",
        "started_at_unix": time.time(),
        "requested_capture_buffer_kib": 32768,
    }
    ceiling = subprocess.run(["/usr/sbin/sysctl", "-n", "debug.bpf_bufsize_cap"],
                             capture_output=True, text=True, check=False)
    report["kernel_bpf_buffer_cap_bytes"] = (
        int(ceiling.stdout.strip())
        if ceiling.returncode == 0 and ceiling.stdout.strip().isdigit() else None
    )
    (evidence / "network-stages.jsonl").write_text("")
    # Reserve the control port before compiling the capture filter. Exclude
    # unrelated loopback/debug traffic in BPF, before packets reach the buffer.
    receiver = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    receiver.bind(("127.0.0.1", 0))
    receiver.settimeout(2)
    port = receiver.getsockname()[1]
    report["control_port"] = port
    packet_filter = (
        "((tcp or udp) and not (net 127.0.0.0/8 or host ::1)) or "
        f"(udp and host 127.0.0.1 and port {port})"
    )
    report["packet_filter"] = packet_filter
    with receiver, packets.open("w") as output, diagnostic.open("w") as errors:
        # The PID belongs to tcpdump after exec, rather than sudo's monitor.
        trace = subprocess.Popen([
            "sudo", "-n", "/bin/sh", "-c",
            'echo $$ > "$1"; shift; exec "$@"', "capture", str(pidfile),
            "/usr/sbin/tcpdump", "-i", "pktap,all", "-k", "NPD",
            "-nn", "-q", "-l", "-tttt", "-s", "512", "-B", "32768",
            "-Q", f"proc =App or eproc =App or pid ={os.getpid()}",
            packet_filter,
        ], stdout=output, stderr=errors)
        try:
            deadline = time.monotonic() + 10
            while "listening on" not in diagnostic.read_text():
                if trace.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Packet capture did not start; inspect network-capture.log")
                time.sleep(0.1)

            # Controlled loopback traffic contains no household or account data.
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sender:
                sender.sendto(b"lifeadmin-network-control", ("127.0.0.1", port))
            receiver.recvfrom(128)
            deadline = time.monotonic() + 5
            while True:
                text = packets.read_text()
                control = [line for line in text.splitlines() if f"127.0.0.1.{port}" in line]
                if control:
                    break
                if trace.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Known control packet was not recorded")
                time.sleep(0.1)
            report["control_packet_seen"] = True
            report["test_started_at_unix"] = time.time()
            capture_snapshot(evidence, "before-test-command")
            result = subprocess.run(command, check=False)
            report["test_exit_code"] = result.returncode
            if trace.poll() is not None:
                raise RuntimeError("Packet capture ended before the test command")
        finally:
            report["test_ended_at_unix"] = time.time()
            capture_snapshot(evidence, "after-test-command")
            if trace.poll() is None and pidfile.exists():
                subprocess.run(["sudo", "-n", "kill", "-INT", pidfile.read_text().strip()], check=True)
            try:
                trace.wait(timeout=10)
            except subprocess.TimeoutExpired:
                subprocess.run(["sudo", "-n", "kill", "-TERM", pidfile.read_text().strip()], check=False)
                trace.wait(timeout=5)
            report["capture_exit_code"] = trace.returncode
            drops = re.findall(r"(\d+) packets dropped by kernel", diagnostic.read_text())
            report["packets_dropped_by_kernel"] = int(drops[-1]) if drops else None
            report["ended_at_unix"] = time.time()
            (evidence / "network-capture.json").write_text(json.dumps(report, indent=2) + "\n")
            pidfile.unlink(missing_ok=True)
    if report["capture_exit_code"] != 0 or report["packets_dropped_by_kernel"] != 0:
        raise RuntimeError("Capture incomplete; inspect network-capture.log")
    # Successful capture is not a zero-network or privacy classification.
    raise SystemExit(report["test_exit_code"])


if __name__ == "__main__":
    main()
