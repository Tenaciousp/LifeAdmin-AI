import { test } from "node:test";
import assert from "node:assert/strict";
import { actionsFor, taskAiPrompt } from "./ai-handoff.mjs";
import { catalog, suggest } from "./domain.mjs";
import { billCategory, fieldsFor, goalsFor } from "./bill-types.mjs";
import { normaliseTask, generateLocalResult, generateAndSaveLocalPlan } from "./plans.mjs";
import { openLocalStore } from "./storage.mjs";
import { IDBFactory } from "fake-indexeddb";

test("water and energy have separate search routes, fields and goals", () => {
  const categories = catalog().categories;
  assert.equal(categories.find(item => item.id === "water").label, "Water and sewerage");
  assert.equal(categories.find(item => item.id === "energy_water").label, "Energy: gas and electricity");
  for (const query of ["water bill", "United Utilities", "Thames Water bill", "Severn Trent", "Anglian Water", "Scottish Water"]) assert.equal(suggest(query).category_id, "water", query);
  assert.equal(suggest("Octopus dual fuel renewal").category_id, "energy_water");
  assert.equal(suggest("water leak").goal_id, "water_usage");
  assert.equal(suggest("water help paying").goal_id, "water_support");
  assert.equal(suggest("switch water").goal_id, "check_bill");
  assert.ok(!goalsFor("water").some(goal => ["cancel_switch", "prepare_renewal"].includes(goal.id)));
  assert.ok(!goalsFor("insurance").some(goal => goal.id.startsWith("water_")));
  const fields = fieldsFor("water", "check_bill");
  for (const id of ["provider", "water_region", "billing_basis", "billing_frequency", "water_usage"]) assert.ok(fields.some(field => field.id === id), id);
  for (const id of ["tariff", "exit_fee", "unit_rate", "desired_outcome"]) assert.ok(!fields.some(field => field.id === id), id);
  const unmetered = fieldsFor("water", "check_bill", { billing_basis: "Unmetered / rateable value" });
  assert.ok(!unmetered.some(field => ["meter_reading", "reading_basis", "water_usage"].includes(field.id)));
});

test("old combined-category water bills retain every supplied fact through backup and planning", async () => {
  const original = { id: "water-1", title: "Saved water bill", category_id: "energy_water", category: "Energy and water", goal_id: "prepare_renewal", details: { utility_type: "Water", tariff: "Water tariff", provider: "United Utilities", amount: "£45", account_reference: "SYNTHETIC-42" } };
  assert.equal(billCategory(original), "water");
  const canonical = normaliseTask(original);
  assert.equal(canonical.category_id, "water");
  assert.equal(canonical.goal_id, "check_bill");
  assert.deepEqual(canonical.details, original.details);
  const store = await openLocalStore({ indexedDB: new IDBFactory() });
  await store.createTask(original);
  const plan = await generateAndSaveLocalPlan(store, original.id);
  assert.match(plan.provider_email.body, /SYNTHETIC-42/);
  assert.doesNotMatch(plan.content, /exit fee|gas tariff|switch provider|unit rate/i);
  const backup = await store.exportBackup();
  await store.clear();
  await store.importBackup(backup, { replace: true });
  assert.deepEqual((await store.read()).tasks, [original]);
  assert.deepEqual(original.details, canonical.details);
  store.close();
});

test("water plans follow the chosen issue, region and supplied facts", () => {
  for (const [goal_id, expected] of [["water_meter", /calculator/], ["water_usage", /leakage.allowance/], ["water_support", /affordable payment/], ["challenge_charge", /complaint reference/]]) {
    const result = generateLocalResult({ title: "Sample water", category_id: "water", goal_id, details: { provider: "Example Water", amount: "£45", billing_frequency: "Monthly", water_region: "England", billing_basis: "Metered", water_usage: "35 cubic metres", what_happened: "Payment increased" } });
    assert.match(result.next_steps, expected);
    for (const value of ["£45", "Monthly", "35 cubic metres", "Payment increased"]) assert.ok(result.provider_email.body.includes(value));
    assert.doesNotMatch(result.next_steps, /switch.*supplier|fixed.tariff|exit.fee/i);
  }
  const scotland = generateLocalResult({ category_id: "water", goal_id: "check_bill", details: { water_region: "Scotland" } });
  assert.match(scotland.next_steps, /Scottish Water/);
  assert.match(scotland.next_steps, /council tax/);
});


test("water AI choices keep regional charging context and exclude supplier-switching tasks", () => {
  const plan = { category_id: "water", known_details: { water_region: "England", billing_basis: "Metered", billing_frequency: "Monthly", account_reference: "PRIVATE-TEST" } };
  assert.ok(!actionsFor(plan).some(action => ["cancel", "negotiate"].includes(action.id)));
  const prompt = taskAiPrompt(plan, { action: "compare" });
  assert.match(prompt, /household water charging/);
  assert.match(prompt, /England/);
  assert.match(prompt, /Metered/);
  assert.doesNotMatch(prompt, /PRIVATE-TEST/);
  assert.throws(() => taskAiPrompt(plan, { action: "cancel" }), /Choose an AI task/);
});
