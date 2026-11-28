import unittest

from prepare_apple_signing import build_export_options
from validate_apple_build_profile import validate_profile


class AppleBuildProfileTests(unittest.TestCase):
    def test_internal_offline_export_sets_documented_internal_only_option(self):
        options = build_export_options("profile-id", "internal-offline")
        self.assertIs(options["testFlightInternalTestingOnly"], True)
        self.assertEqual(options["method"], "app-store-connect")

    def test_live_release_export_does_not_set_internal_only_option(self):
        options = build_export_options("profile-id", "live-release")
        self.assertNotIn("testFlightInternalTestingOnly", options)

    def test_export_rejects_unknown_profile(self):
        with self.assertRaisesRegex(ValueError, "Choose internal-offline"):
            build_export_options("profile-id", "")

    def test_internal_offline_disables_api_and_requests_internal_only(self):
        self.assertEqual(validate_profile("internal-offline", ""), {
            "api_enabled": False, "customer_key_relay_enabled": False,
            "distribution_mode_requested": "testflight-internal-only",
            "distribution_mode_verified": False})

    def test_internal_offline_rejects_configured_endpoint(self):
        with self.assertRaisesRegex(ValueError, "rejects a configured"):
            validate_profile("internal-offline", "https://ai.example")

    def test_live_release_requires_clean_https_origin(self):
        self.assertEqual(validate_profile("live-release", "https://ai.example"), {
            "api_enabled": True, "customer_key_relay_enabled": False,
            "distribution_mode_requested": "app-store-connect",
            "distribution_mode_verified": False})
        for origin in ("", "http://ai.example", "https://u:p@ai.example", "https://ai.example/path"):
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                validate_profile("live-release", origin)

    def test_unknown_profile_rejected(self):
        with self.assertRaisesRegex(ValueError, "choose internal-offline"):
            validate_profile("", "")


if __name__ == "__main__":
    unittest.main()
