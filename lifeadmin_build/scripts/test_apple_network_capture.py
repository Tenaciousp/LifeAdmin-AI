"""Synthetic checks for allocation/counter evidence and process filtering."""
from contextlib import chdir
import json
import re
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

from capture_apple_network import capture_network, capture_snapshot
from smoke_apple_simulator import run_ui_test


class CaptureSnapshotTests(unittest.TestCase):
    def test_recorder_counters_and_unknown_allocation(self):
        with tempfile.TemporaryDirectory() as temporary:
            evidence = Path(temporary)
            (evidence / "network-capture.pid").write_text("7319")
            header = "Device Netif Flags Recv RDrop RMatch RSize ReadCnt Bsize Command\n"
            rows = ("bpf1 pktap0 - 100 7 93 512 4 33554432 tcpdump.7319\n"
                    "bpf2 en0 - 900 0 900 512 4 4096 unrelated.99\n")
            with patch("capture_apple_network.subprocess.run", return_value=
                       subprocess.CompletedProcess([], 0, header + rows, "")):
                capture_snapshot(evidence, "before:keyboard")
            sample = json.loads((evidence / "network-stages.jsonl").read_text())
            self.assertTrue(sample["allocation_observed"])
            self.assertEqual(len(sample["bpf_devices"]), 1)
            self.assertEqual(sample["bpf_devices"][0]["Bsize"], "33554432")
            self.assertEqual(sample["bpf_devices"][0]["RDrop"], "7")
            self.assertNotIn("unrelated", json.dumps(sample))
            for result in (subprocess.CompletedProcess([], 1, "", "denied"),
                           subprocess.TimeoutExpired("netstat", 10)):
                with patch("capture_apple_network.subprocess.run") as run:
                    if isinstance(result, Exception):
                        run.side_effect = result
                    else:
                        run.return_value = result
                    capture_snapshot(evidence, "after:keyboard")
                sample = json.loads((evidence / "network-stages.jsonl").read_text().splitlines()[-1])
                self.assertFalse(sample["allocation_observed"])
                self.assertNotIn("RDrop", sample)
            (evidence / "network-capture.pid").unlink()
            with patch("capture_apple_network.subprocess.run") as run:
                capture_snapshot(evidence, "uncaptured-upgrade")
                run.assert_not_called()

    def test_capture_segments_keep_zero_loss_gate_and_record_failure(self):
        for dropped, customer_failure in ((0, False), (3, False), (0, True)):
            with self.subTest(dropped=dropped, customer_failure=customer_failure), tempfile.TemporaryDirectory() as temporary, chdir(temporary):
                trace = Mock(returncode=0)
                trace.poll.return_value = None
                def start(*args, **kwargs):
                    port = re.search(r"port (\d+)", args[0][-1]).group(1)
                    kwargs["stdout"].write("127.0.0.1." + port + " control\n")
                    kwargs["stdout"].flush()
                    kwargs["stderr"].write("listening on pktap,all\n")
                    kwargs["stderr"].flush()
                    Path("apple-launch-evidence/network-capture.pid").write_text("7319")
                    def finish(**_):
                        kwargs["stderr"].write(str(dropped) + " packets dropped by kernel\n")
                        kwargs["stderr"].flush()
                    trace.wait.side_effect = finish
                    return trace
                with patch("capture_apple_network.sys.platform", "darwin"), patch(
                    "capture_apple_network.subprocess.Popen", side_effect=start
                ), patch("capture_apple_network.subprocess.run", return_value=
                         subprocess.CompletedProcess([], 0, "33554432", "")), patch(
                    "capture_apple_network.capture_snapshot"
                ):
                    expected = ValueError if customer_failure else RuntimeError if dropped else None
                    def acceptance():
                        with capture_network("preflight"):
                            if customer_failure:
                                raise ValueError("Native assertion failed")
                    if expected:
                        with self.assertRaises(expected):
                            acceptance()
                    else:
                        acceptance()
                report = json.loads(Path("apple-launch-evidence/network-capture-preflight.json").read_text())
                self.assertEqual(report["packets_dropped_by_kernel"], dropped)
                self.assertEqual(report["test_exit_code"], int(customer_failure))
                self.assertTrue(report["control_packet_seen"])
                self.assertFalse(Path("apple-launch-evidence/network-capture.pid").exists())

    def test_failed_ui_test_keeps_timeout_and_after_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            evidence = Path(temporary)
            with patch("capture_apple_network.capture_snapshot") as snapshot, patch(
                "smoke_apple_simulator.subprocess.run",
                side_effect=subprocess.CalledProcessError(65, "xcodebuild")
            ) as run:
                with self.assertRaises(subprocess.CalledProcessError):
                    run_ui_test("synthetic-device", evidence, "keyboard", "test.log", "test.xcresult")
                self.assertEqual([call.args[1] for call in snapshot.call_args_list],
                                 ["before:keyboard", "after:keyboard"])
                command = run.call_args.args[0]
                self.assertEqual(command[command.index("-maximum-test-execution-time-allowance") + 1], "900")
                self.assertEqual(run.call_args.kwargs["timeout"], 1200)


if __name__ == "__main__":
    unittest.main()
