import base from "./catalog.json" with { type: "json" };

const field = (id, label, type = "text", extra = {}) => ({ id, label, type, required: false, ...extra });
const waterGoalLabels = {
  check_bill: "Understand or check my water bill",
  reduce_price: "Explore ways to lower my water costs",
  water_meter: "Check whether a water meter suits my home",
  water_usage: "Investigate high usage or a possible leak",
  water_support: "Ask for help paying my water bill",
  challenge_charge: "Query a charge or meter reading",
  contact_provider: "Ask my water company a question",
};
export const customerCatalog = structuredClone(base);
const energy = customerCatalog.categories.find(item => item.id === "energy_water");
energy.label = "Energy: gas and electricity";
energy.synonyms = energy.synonyms.filter(value => !/water|utilities|severn trent/.test(value));
energy.examples = "Electricity tariff review; gas bill query; energy renewal";
energy.fields = energy.fields.map(item => item.id === "utility_type" ? { ...item, options: ["Electricity", "Gas", "Dual fuel", "Not sure"] } : item.id === "tariff" ? { ...item, options: item.options.filter(value => value !== "Water tariff") } : item);
const water = {
  id: "water", label: "Water and sewerage", popular: true,
  synonyms: ["water", "sewerage", "wastewater", "water meter", "water bill", "united utilities", "thames water", "yorkshire water", "severn trent", "anglian water", "welsh water", "dwr cymru", "south west water", "southern water", "scottish water", "northumbrian water", "affinity water", "portsmouth water", "ses water", "bournemouth water", "bristol water", "south east water", "wessex water", "ni water"],
  examples: "Check a water bill; compare metered charges; ask about payment support",
  goal_ids: Object.keys(waterGoalLabels), goal_labels: waterGoalLabels,
  fields: [
    field("provider", "Water company", "text", { placeholder: "e.g. United Utilities", recommended: true }),
    field("amount", "Current payment or bill amount", "text", { placeholder: "e.g. £45", recommended: true }),
    field("billing_frequency", "How often is this amount paid?", "select", { options: ["Monthly", "Quarterly", "Six-monthly", "Yearly", "One bill", "Not sure"] }),
    field("water_region", "Where is your home?", "select", { options: ["England", "Wales", "Scotland", "Northern Ireland", "Outside the UK", "Not sure"], recommended: true }),
    field("billing_basis", "How is your water bill calculated?", "select", { options: ["Metered", "Unmetered / rateable value", "Assessed charge", "Included in council tax / rates", "Not sure"], recommended: true }),
    field("what_happened", "What would you like checked?", "textarea", { placeholder: "e.g. My monthly payment rose, but my water use has not changed" }),
    field("water_services", "Which services are on this bill?", "select", { options: ["Water and sewerage", "Water only", "Sewerage only", "Not sure"] }),
    field("household_size", "People living at home", "text", { placeholder: "e.g. 2 adults" }),
    field("bill_period", "Dates covered by the bill", "text", { placeholder: "e.g. April to September 2026" }),
    field("reading_basis", "Meter readings on the bill", "select", { options: ["Actual readings", "Estimated readings", "A mix of both", "Not sure"] }),
    field("meter_reading", "Latest water meter reading", "text", { placeholder: "Reading and date, if known" }),
    field("water_usage", "Water use shown on the bill", "text", { placeholder: "e.g. 35 cubic metres over six months" }),
    field("previous_amount", "Previous payment or bill amount", "text", { placeholder: "Include the payment frequency" }),
    field("account_reference", "Customer reference (optional)", "text", { placeholder: "Leave blank unless needed in your message" }),
  ],
};
customerCatalog.categories.splice(customerCatalog.categories.indexOf(energy) + 1, 0, water);
for (const [id, label] of Object.entries(waterGoalLabels)) {
  if (!customerCatalog.goals.some(goal => goal.id === id)) customerCatalog.goals.push({ id, label, synonyms: [], fields: [] });
}
for (const key of ["popular_choices", "popular"]) customerCatalog[key].push({ id: "water_check", label: "Check my water bill", category_id: "water", goal_id: "check_bill" });
customerCatalog.popular_categories = customerCatalog.categories.filter(item => item.popular);
customerCatalog.examples = customerCatalog.categories.map(item => ({ category_id: item.id, text: item.examples }));

export function billCategory(task) {
  const id = task.category_id || task.category;
  if (["energy_water", "Gas, electricity or water", "Energy and water"].includes(id)) {
    const d = task.details || {};
    return /water/i.test(String(d.utility_type || "") + " " + String(d.tariff || "")) ? "water" : "energy_water";
  }
  return id;
}
export function goalsFor(categoryId) {
  const category = customerCatalog.categories.find(item => item.id === categoryId);
  const available = category?.goal_ids ? category.goal_ids.map(id => customerCatalog.goals.find(goal => goal.id === id)) : customerCatalog.goals.filter(goal => !goal.id.startsWith("water_"));
  return available.map(goal => ({ ...goal, label: category?.goal_labels?.[goal.id] || goal.label }));
}
export function fieldsFor(categoryId, goalId, details = {}) {
  const category = customerCatalog.categories.find(item => item.id === categoryId);
  const goal = customerCatalog.goals.find(item => item.id === goalId);
  if (!category || !goalId) return [];
  const fields = categoryId === "water" ? category.fields : [...new Map([...category.fields, ...(goal?.fields || [])].map(item => [item.id, item])).values()];
  return fields.filter(item => item.id !== "desired_outcome" && !(categoryId === "water" && ["Unmetered / rateable value", "Assessed charge", "Included in council tax / rates"].includes(details.billing_basis) && ["meter_reading", "reading_basis", "water_usage"].includes(item.id))).map(item => {
    if (categoryId !== "energy_water") return item;
    if (item.id === "provider") return { ...item, label: "Energy supplier", placeholder: "e.g. Octopus Energy or British Gas" };
    if (item.id === "what_happened") return { ...item, label: "What changed on your energy bill?" };
    return item;
  });
}
