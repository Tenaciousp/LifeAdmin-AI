import test from "node:test";
import assert from "node:assert/strict";
import { hasDatedSourceReference } from "./source-evidence.mjs";

test("recognizes ISO dates next to provider links", () => {
  assert.equal(hasDatedSourceReference("https://provider.example/tariff (checked 2026-11-19)"), true);
});

test("recognizes written dates with a source check label", () => {
  assert.equal(hasDatedSourceReference("Offer: https://provider.example/tariff, verified on 19 November 2026"), true);
});

test("does not treat a link without a date as dated evidence", () => {
  assert.equal(hasDatedSourceReference("https://provider.example/tariff"), false);
});

test("does not treat a date without a link as source evidence", () => {
  assert.equal(hasDatedSourceReference("Checked on 2026-11-19"), false);
});

test("ignores non-text source content", () => {
  assert.equal(hasDatedSourceReference(null), false);
});
