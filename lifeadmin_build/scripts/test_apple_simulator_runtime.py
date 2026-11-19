import unittest

from smoke_apple_simulator import select_ios_runtime


def runtime(version, available=True, identifier=None):
    return {
        "identifier": identifier or "com.apple.CoreSimulator.SimRuntime.iOS-" + version.replace(".", "-"),
        "version": version,
        "isAvailable": available,
    }


class AppleSimulatorRuntimeTests(unittest.TestCase):
    def test_prefers_known_stable_262_when_present(self):
        stable = runtime("26.2")
        self.assertIs(select_ios_runtime([runtime("27.0"), stable]), stable)

    def test_falls_forward_to_newest_available_ios_runtime(self):
        newest = runtime("27.0")
        self.assertIs(select_ios_runtime([runtime("26.5"), newest, runtime("28.0", False)]), newest)

    def test_same_version_prefers_runtime_with_wider_device_support(self):
        device_specific = runtime("27.2", identifier="com.apple.CoreSimulator.SimRuntime.iOS-27-2-iPhone19-4")
        device_specific["supportedDeviceTypes"] = [{"identifier": "iPhone-Duo"}]
        general = runtime("27.2", identifier="com.apple.CoreSimulator.SimRuntime.iOS-27-2")
        general["supportedDeviceTypes"] = [{"identifier": f"device-{number}"} for number in range(20)]
        self.assertIs(select_ios_runtime([general, device_specific]), general)

    def test_ignores_non_ios_and_unavailable_runtimes(self):
        ios = runtime("27.0")
        watch = runtime("27.0", identifier="com.apple.CoreSimulator.SimRuntime.watchOS-27-0")
        self.assertIs(select_ios_runtime([watch, runtime("28.0", False), ios]), ios)

    def test_reports_missing_ios_runtimes(self):
        with self.assertRaisesRegex(RuntimeError, "No available iOS simulator runtime"):
            select_ios_runtime([runtime("27.0", False)])


if __name__ == "__main__":
    unittest.main()
