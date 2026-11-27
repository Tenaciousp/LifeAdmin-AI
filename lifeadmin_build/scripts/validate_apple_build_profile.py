"""Fail-closed build profiles for HomeAdmin's manual Apple signing workflow."""
from urllib.parse import urlsplit


def validate_profile(profile, origin):
    if profile == "internal-offline":
        if origin.strip():
            raise ValueError("internal-offline profile rejects a configured AI endpoint")
        return {"api_enabled": False, "customer_key_relay_enabled": False,
                "distribution_mode_requested": "testflight-internal-only",
                "distribution_mode_verified": False}
    if profile != "live-release":
        raise ValueError("choose internal-offline or live-release")
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment or any(char.isspace() for char in origin)):
        raise ValueError("live-release requires a clean HTTPS origin")
    return {"api_enabled": True, "customer_key_relay_enabled": False,
            "distribution_mode_requested": "app-store-connect",
            "distribution_mode_verified": False}
