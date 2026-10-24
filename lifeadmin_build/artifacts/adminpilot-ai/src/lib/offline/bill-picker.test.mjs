import test from "node:test";
import assert from "node:assert/strict";
import { billGroups, billTypeForSuggestion, groupForCategory, resolveBillType } from "./bill-picker.mjs";

test("bill picker covers approved groups and specific types", () => {
  assert.equal(billGroups.length, 10);
  assert.ok(billGroups.every(group => group.types.length > 0));
  assert.equal(groupForCategory("energy_water").label, "Energy");
  assert.deepEqual(groupForCategory("energy_water").types.map(type => type.label), ["Electricity", "Gas", "Combined gas and electricity", "District heating", "Heating fuel (oil, LPG, solid fuel)"]);
  assert.equal(groupForCategory("water").label, "Water and sewerage");
  assert.deepEqual(groupForCategory("water").types.map(type => type.label), ["Water", "Sewerage", "Water and sewerage"]);
});

test("specific type resolves for display and edit without changing storage category IDs", () => {
  const resolved = resolveBillType({ category_id: "energy_water", details: { bill_type_id: "water", bill_type: "Water", water_services: "Water only" } });
  assert.equal(resolved.group.id, "water_services");
  assert.equal(resolved.type.label, "Water");
  assert.equal(groupForCategory("energy_water").category_id, "energy_water");
});

test("legacy type details are inferred when no new picker ID exists", () => {
  const resolved = resolveBillType({ category_id: "tv_broadband_mobile", details: { service_type: "Mobile phone" } });
  assert.equal(resolved.type.id, "mobile");
  assert.equal(groupForCategory("water").id, "water_services");
  assert.equal(resolveBillType({ category_id: "water", details: { water_services: "Sewerage only" } }).type.id, "sewerage");
  assert.equal(resolveBillType({ category_id: "energy_water", category: "Energy and water", details: { utility_type: "Water", tariff: "Water tariff" } }).type.id, "water");
});

test("provider suggestions preselect a specific type when the query identifies one", () => {
  const netflix = billTypeForSuggestion("subscriptions_memberships", "Cancel Netflix", { provider: "Netflix" });
  assert.equal(netflix.type.id, "video_music");
  assert.equal(netflix.group.id, "subscriptions");
  const water = billTypeForSuggestion("energy_water", "Review my water bill", {});
  assert.equal(water.type.id, "water");
  assert.equal(water.group.id, "water_services");
  assert.equal(billTypeForSuggestion("energy_water", "Review sewerage charges", {}).type.id, "sewerage");
  assert.equal(billTypeForSuggestion("energy_water", "Review electricity bill", {}).group.id, "energy");
  assert.equal(billTypeForSuggestion("water", "Water", {}).type.id, "water");
  assert.equal(billTypeForSuggestion("energy_water", "Review energy", {})?.type, undefined);
});
