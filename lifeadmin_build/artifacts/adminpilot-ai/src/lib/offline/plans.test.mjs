import { test } from "node:test";
import "./handoff.test.mjs";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { openLocalStore } from "./storage.mjs";
import { generateAndSaveLocalPlan, generateLocalResult, planTextForCopy } from "./plans.mjs";

globalThis.fetch = () => { throw new Error("Unexpected network request"); };

test("energy plan generation, save and backup round trip need no network", async () => {
  const store = await openLocalStore({ indexedDB: new IDBFactory() });
  await store.createTask({ id: "energy", title: "Energy renewal", category_id: "energy_water", goal_id: "prepare_renewal", details: { provider: "Example Energy" } });
  const note = await generateAndSaveLocalPlan(store, "energy");
  assert.equal(note.source, "local");
  assert.equal(note.provider_email.kind, "provider");
  assert.equal(Object.keys(note.sections).length, 4);
  const backup = await store.exportBackup();
  await store.clear();
  await store.importBackup(backup, { replace: true });
  assert.deepEqual((await store.read()).plans, [note]);
  store.close();
});

test("unknown payments keep a bank-query draft and fraud guidance", () => {
  const result = generateLocalResult({ title: "Unknown", category_id: "other_regular_payment", goal_id: "identify_payment", notes: "fraud", details: {} });
  assert.equal(result.provider_message, "");
  assert.equal(result.provider_email.kind, "bank_query");
  assert.match(result.things_to_check, /official fraud channel/);
});

test("water and insurance plans work without server generation", async () => {
  const store = await openLocalStore({ indexedDB: new IDBFactory() });
  await store.createTask({ id: "water", title: "Water renewal", category_id: "energy_water", goal_id: "prepare_renewal", details: { utility_type: "Water" } });
  await generateAndSaveLocalPlan(store, "water");
  assert.ok(generateLocalResult({ category_id: "insurance", goal_id: "prepare_renewal", details: {} }).content);
  await assert.rejects(generateAndSaveLocalPlan(store, "missing"), /Bill not found/);
  assert.equal((await store.read()).plans.length, 1);
  store.close();
});


test("customer placeholder-like text stays literal", () => {
  const result = generateLocalResult({ title: "Subscription", category_id: "subscriptions_memberships", goal_id: "cancel_switch", details: { provider: "__LIFEADMIN_CANCELLATION_ROUTE__" } });
  assert.match(result.content, /Provider: __LIFEADMIN_CANCELLATION_ROUTE__/);
});


test("copy output retains visible safety guidance from restored plans", () => {
  const cases = [
    ["other_regular_payment", "identify_payment", "fraud", "official fraud channel"],
    ["energy_water", "prepare_renewal", "cannot pay arrears", "facing disconnection"],
    ["rent_mortgage_property", "check_bill", "eviction", "qualified housing or debt advice"],
    ["insurance", "check_bill", "urgent claim fire", "official claims or emergency route"],
  ];
  for (const [category_id, goal_id, notes, expected] of cases) {
    const result = generateLocalResult({ title: "Synthetic bill", category_id, goal_id, notes, details: {} });
    const copied = planTextForCopy({
      title: "Restored bill", content: "Stale stored text",
      sections: Object.fromEntries(["next_steps", "provider_message", "things_to_check", "approval_checklist"].map(key => [key, result[key]])),
      provider_email: result.provider_email, missing_details: result.missing_details,
    });
    assert.ok(result.things_to_check.includes(expected), category_id + " visible guidance");
    assert.ok(copied.includes(expected), category_id + " copied guidance");
    assert.equal(copied.split("## Safety check").length, 2);
    assert.ok(!copied.includes("Stale stored text"));
  }
});

test("copy follows visible sections and the bank draft without duplicate messages", () => {
  const copied = planTextForCopy({
    title: "Restored plan", content: "Hidden old text",
    missing_details: ["Payment date"],
    sections: { next_steps: "## Next steps\nReview the payment", provider_message: "Old provider wording",
      things_to_check: "Keep the statement", approval_checklist: "Use the official bank route" },
    provider_email: { kind: "bank_query", subject: "Payment query", body: "Reference SYN-4812" },
  });
  for (const text of ["Restored plan", "Payment date", "Review the payment", "Keep the statement",
    "Use the official bank route", "Bank-query draft", "Payment query", "SYN-4812"]) assert.ok(copied.includes(text));
  assert.ok(!copied.includes("Old provider wording"));
  assert.ok(!copied.includes("Hidden old text"));
  assert.ok(!copied.includes("Provider-message draft"));
  assert.equal(copied.match(/## next steps/g).length, 1);
});

test("content-only restored plans retain their readable body when copied", () => {
  const copied = planTextForCopy({ title: "Legacy bill", content: "Retained legacy plan body." });
  assert.ok(copied.includes("Legacy bill"));
  assert.ok(copied.includes("Retained legacy plan body."));
});

