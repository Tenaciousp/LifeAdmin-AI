import { test } from "node:test";
import assert from "node:assert/strict";
import { billOverview, recurringCost, money } from "./bill-overview.mjs";
import { fieldsFor } from "./bill-types.mjs";
import { generateLocalResult } from "./plans.mjs";
import { openLocalStore } from "./storage.mjs";
import { IDBFactory } from "fake-indexeddb";

const task = (id, details, status = "Open") => ({ id, title: id, category_id: "subscriptions_memberships", goal_id: "check_bill", status, details });
test("forecasts keep currencies separate and never invent old-record amounts", () => {
  const summary = billOverview([
    task("UK", { amount: "10", currency: "GBP", billing_frequency: "Monthly" }),
    task("US", { amount: "120", currency: "USD", billing_frequency: "Yearly" }),
    task("old", { amount: "£45 per month" }),
    task("oneoff", { amount: "20", currency: "GBP", billing_frequency: "One bill" }),
    task("done", { amount: "1000", currency: "GBP", billing_frequency: "Monthly" }, "Done"),
  ], "2026-10-22");
  assert.equal(summary.active, 4); assert.equal(summary.unpriced, 2);
  assert.deepEqual(summary.totals, [{ currency: "GBP", monthly: 10, yearly: 120 }, { currency: "USD", monthly: 10, yearly: 120 }]);
  for (const amount of ["-4", "1,25", "NaN", "Infinity", "£25", "25 per month", "1e3"]) assert.equal(recurringCost(task("bad", { amount, currency: "GBP", billing_frequency: "Monthly" })), null);
  assert.match(money(10, "USD"), /USD/);
});
test("payment recurrence and past dates remain explicit, not falsely paid or rescheduled", () => {
  for (const [frequency, expected] of [["Weekly", 52], ["Fortnightly", 26], ["Four-weekly", 13], ["Quarterly", 4], ["Six-monthly", 2]]) {
    assert.equal(recurringCost(task("frequency", { amount: "12", currency: "EUR", billing_frequency: frequency })).monthly, expected);
  }
  const summary = billOverview([task("A", { next_payment_date: "2026-10-23", renewal_date: "2026-10-20", follow_up_date: "2026-02-30" })], "2026-10-22");
  assert.deepEqual(summary.upcoming.map(item => [item.kind, item.overdue]), [["Renewal", true], ["Payment", false]]);
});
test("international bills get local context without UK rights or default currency", () => {
  const bill = task("Canadian internet", { country: "Canada", currency: "CAD", amount: "75", billing_frequency: "Monthly", provider: "Example ISP", service_type: "Broadband / internet" });
  bill.category_id = "tv_broadband_mobile";
  const plan = generateLocalResult(bill);
  assert.match(plan.next_steps, /Canada/); assert.match(plan.provider_email.body, /Example ISP/);
  assert.match(plan.things_to_check, /CAD/); assert.match(plan.provider_email.body, /75/);
  assert.doesNotMatch(plan.content, /Ofcom|Ofgem|14.day cooling/);
  const water = generateLocalResult({ ...bill, category_id: "water", details: { ...bill.details, water_region: "Scotland", billing_basis: "Metered" } });
  assert.doesNotMatch(water.next_steps, /Scottish Water|council tax bill/);
  assert.doesNotMatch(water.things_to_check, /https:\/\/www.ofwat/);
  const fields = fieldsFor("water", "check_bill", { country: "Canada" });
  assert.equal(fields.find(field => field.id === "water_region").type, "text");
  assert.ok(fieldsFor("tv_broadband_mobile", "check_bill").find(field => field.id === "service_type").options.includes("Mobile phone"));
});
test("international bill details survive plan generation and backup restore", async () => {
  const store = await openLocalStore({ indexedDB: new IDBFactory() });
  const bill = task("Singapore water", { country: "Singapore", currency: "SGD", amount: "35.25", billing_frequency: "Monthly", next_payment_date: "2026-11-01", water_region: "Central" });
  await store.createTask(bill);
  const backup = await store.exportBackup();
  await store.importBackup(backup, { replace: true });
  assert.deepEqual((await store.read()).tasks[0].details, bill.details);
  store.close();
});
