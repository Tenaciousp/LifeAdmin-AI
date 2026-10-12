import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { openLocalStore } from "./storage.mjs";
import { generateAndSaveLocalPlan, generateLocalResult } from "./plans.mjs";

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

test("unmigrated routes and water renewals never fall back to server generation", async () => {
  const store = await openLocalStore({ indexedDB: new IDBFactory() });
  await store.createTask({ id: "water", title: "Water renewal", category_id: "energy_water", goal_id: "prepare_renewal", details: { utility_type: "Water" } });
  await assert.rejects(generateAndSaveLocalPlan(store, "water"), /not yet been migrated/);
  assert.throws(() => generateLocalResult({ category_id: "insurance", goal_id: "prepare_renewal", details: {} }), /not yet been migrated/);
  await assert.rejects(generateAndSaveLocalPlan(store, "missing"), /Bill not found/);
  assert.equal((await store.read()).plans.length, 0);
  store.close();
});
