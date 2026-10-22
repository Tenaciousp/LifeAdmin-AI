import test from "node:test";
import assert from "node:assert/strict";
import { billGroups, groupForCategory, resolveBillType } from "./bill-picker.mjs";

test("bill picker covers approved groups and specific types", () => {
  assert.equal(billGroups.length, 9);
  assert.ok(billGroups.every(group => group.types.length > 0));
  assert.deepEqual(groupForCategory("energy_water").types.slice(0, 3).map(type => type.label), ["Electricity", "Gas", "Combined gas and electricity"]);
  assert.ok(groupForCategory("energy_water").types.some(type => type.label === "Water"));
  assert.ok(groupForCategory("energy_water").types.some(type => type.label === "Sewerage"));
});

test("specific type resolves for display and edit without changing storage category IDs", () => {
  const resolved = resolveBillType({ category_id: "energy_water", details: { bill_type_id: "water", bill_type: "Water", water_services: "Water only" } });
  assert.equal(resolved.group.id, "home_utilities");
  assert.equal(resolved.type.label, "Water");
  assert.equal(groupForCategory("energy_water").category_id, "energy_water");
});

test("legacy type details are inferred when no new picker ID exists", () => {
  const resolved = resolveBillType({ category_id: "tv_broadband_mobile", details: { service_type: "Mobile phone" } });
  assert.equal(resolved.type.id, "mobile");
  assert.equal(groupForCategory("water").id, "home_utilities");
  assert.equal(resolveBillType({ category_id: "water", details: { water_services: "Sewerage only" } }).type.id, "sewerage");
});
