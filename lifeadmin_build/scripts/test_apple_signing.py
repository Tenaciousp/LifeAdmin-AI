"""Synthetic profile rejection checks; no Apple credentials are used."""
import copy
import datetime as dt
import unittest

from prepare_apple_signing import BUNDLE, TEAM, validate_profile


class DistributionProfileTests(unittest.TestCase):
    def test_profile_scope_and_expiry(self):
        profile = {
            "UUID": "6D280A9A-6E84-4774-BF0B-F50F0F3818E7", "TeamIdentifier": [TEAM],
            "ExpirationDate": dt.datetime(2030, 1, 1), "Platform": ["iOS"],
            "Entitlements": {"application-identifier": TEAM + "." + BUNDLE,
                             "com.apple.developer.team-identifier": TEAM, "get-task-allow": False},
        }
        now = dt.datetime(2026, 10, 19, tzinfo=dt.timezone.utc)
        self.assertEqual(validate_profile(profile, now), profile["UUID"])
        changes = {
            "different team": lambda p: p.update(TeamIdentifier=["WRONG"]),
            "wildcard app": lambda p: p["Entitlements"].update({"application-identifier": TEAM + ".*"}),
            "entitlement team": lambda p: p["Entitlements"].update({"com.apple.developer.team-identifier": "WRONG"}),
            "expired": lambda p: p.update(ExpirationDate=dt.datetime(2020, 1, 1)),
            "ad hoc": lambda p: p.update(ProvisionedDevices=["test"]),
            "enterprise": lambda p: p.update(ProvisionsAllDevices=True),
            "development": lambda p: p["Entitlements"].update({"get-task-allow": True}),
            "macOS": lambda p: p.update(Platform=["macOS"]),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                invalid = copy.deepcopy(profile)
                change(invalid)
                with self.assertRaises(ValueError):
                    validate_profile(invalid, now)


if __name__ == "__main__":
    unittest.main()
