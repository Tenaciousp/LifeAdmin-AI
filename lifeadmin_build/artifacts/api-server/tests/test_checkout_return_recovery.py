"""Execute the checkout-return effect with synthetic browser and network boundaries."""
from pathlib import Path
import subprocess
import unittest


SOURCE = Path(__file__).resolve().parents[2] / "adminpilot-ai/src/components/CheckoutReturnHandler.tsx"

HARNESS = r'''
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const scenario = process.argv[1];
const source = fs.readFileSync(process.argv[2], "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export function CheckoutReturnHandler", "function CheckoutReturnHandler");
const initial = "https://app.example.test/?keep=yes&checkout=success&session_id=cs_synthetic_return#plans";
const notices = [];
const calls = [];
const invalidations = [];
let effect, cleanup;
let href = initial;
let responses = scenario === "processing"
  ? [{ ok: true, body: { paid: false } }, { ok: true, body: { paid: true, product_id: "core_app" } }]
  : [{ ok: false, body: { error: "Temporary verification failure" } },
     { ok: true, body: { paid: true, product_id: "core_app" } }];
if (scenario === "paid") responses = [{ ok: true, body: { paid: true, product_id: "core_app" } }];
if (scenario === "network") responses[0] = new Error("Network unavailable");
if (scenario === "cancelled") href = initial.replace("checkout=success", "checkout=cancelled");
const location = { get href() { return href; }, get search() { return new URL(href).search; } };
const context = {
  URL, URLSearchParams, console,
  window: { location, history: { replaceState: (_, __, next) => { href = new URL(next, href).href; } } },
  useEffect: callback => { effect = callback; },
  useQueryClient: () => ({ invalidateQueries: async value => { invalidations.push(value); } }),
  toast: Object.fromEntries(["success", "info", "error"].map(kind =>
    [kind, (message, options) => notices.push({ kind, message, options })])),
  trackEvent: () => {},
  fetch: async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, "Unexpected verification request");
    return { ok: response.ok, json: async () => response.body };
  },
};
vm.createContext(context);
vm.runInContext(source + "\nCheckoutReturnHandler();", context);
cleanup = effect();
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  await settle();
  if (scenario === "cancelled") {
    assert.equal(calls.length, 0);
    assert.equal(new URL(href).searchParams.has("checkout"), false);
    assert.equal(new URL(href).searchParams.get("keep"), "yes");
    return;
  }
  assert.equal(calls[0].url, "/api/checkout/status?session_id=cs_synthetic_return");
  assert.equal(calls[0].options.credentials, "same-origin");
  if (scenario !== "paid") {
    assert.equal(href, initial, "An unconfirmed purchase must retain its return reference");
    assert.equal(invalidations.length, 0, "Unconfirmed payment must not announce unlocked access");
    const notice = notices.at(-1);
    assert.equal(notice.kind, scenario === "processing" ? "info" : "error");
    assert.equal(notice.options.action.label, "Retry verification");
    if (scenario === "unmounted") {
      cleanup();
      notice.options.action.onClick();
      await settle();
      assert.equal(calls.length, 1, "A stale retry must not verify after leaving the page");
      return;
    }
    notice.options.action.onClick();
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, calls[0].url, "Retry must confirm the original session, not start checkout");
  }
  assert.equal(notices.at(-1).message, "HomeAdmin Complete unlocked");
  assert.equal(notices.at(-1).kind, "success");
  assert.equal(invalidations.length, 1);
  const url = new URL(href);
  assert.equal(url.searchParams.has("checkout"), false);
  assert.equal(url.searchParams.has("session_id"), false);
  assert.equal(url.searchParams.get("keep"), "yes");
  assert.equal(url.hash, "#plans");
})().catch(error => { console.error(error); process.exitCode = 1; });
'''


class CheckoutReturnRecoveryTests(unittest.TestCase):
    def test_verification_lifecycle(self):
        for scenario in ("http_error", "network", "processing", "paid", "cancelled", "unmounted"):
            with self.subTest(scenario=scenario):
                result = subprocess.run(["node", "-e", HARNESS, scenario, str(SOURCE)],
                                        capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
