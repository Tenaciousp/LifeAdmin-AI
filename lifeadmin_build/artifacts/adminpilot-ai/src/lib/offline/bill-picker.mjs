// Customer-facing bill choices map onto stable catalogue IDs so existing records remain compatible.
const groups = [
  { id: "home_utilities", label: "Home utilities", category_id: "energy_water", types: [
    ["electricity", "Electricity", "utility_type", "Electricity"], ["gas", "Gas", "utility_type", "Gas"], ["dual_fuel", "Combined gas and electricity", "utility_type", "Dual fuel"],
    ["water", "Water", "water_services", "Water only"], ["sewerage", "Sewerage", "water_services", "Sewerage only"], ["water_sewerage", "Water and sewerage", "water_services", "Water and sewerage"],
    ["district_heating", "District heating", "utility_type", "District heating"], ["heating_fuel", "Heating fuel (oil, LPG, solid fuel)", "utility_type", "Heating fuel"], ["waste_collection", "Waste collection", "service_type", "Waste collection"],
  ] },
  { id: "housing_charges", label: "Housing and local charges", category_id: "rent_mortgage_property", types: [
    ["rent", "Rent", "service_type", "Rent"], ["mortgage", "Mortgage", "service_type", "Mortgage"], ["property_rates", "Property / council / local rates", "service_type", "Property / municipal tax"],
    ["service_charge", "Service / estate charge", "service_type", "Service / strata charge"], ["ground_rent", "Ground rent", "service_type", "Ground rent"], ["repairs", "Repairs and maintenance", "service_type", "Repairs / maintenance"],
    ["boiler_cover", "Boiler / home-emergency cover", "service_type", "Heating / appliance cover"], ["home_security", "Home security", "service_type", "Home security"],
  ] },
  { id: "phone_internet_tv", label: "Phone, internet and TV", category_id: "tv_broadband_mobile", types: [
    ["broadband", "Broadband / internet", "service_type", "Broadband / internet"], ["mobile", "Mobile phone", "service_type", "Mobile phone"], ["landline", "Landline", "service_type", "Landline"],
    ["tv_package", "TV package", "service_type", "TV package"], ["tv_licence", "TV licence", "service_type", "TV licence"],
  ] },
  { id: "insurance", label: "Insurance", category_id: "insurance", types: [
    ["vehicle_insurance", "Vehicle", "policy_type", "Vehicle"], ["buildings_insurance", "Buildings", "policy_type", "Buildings"], ["contents_insurance", "Contents / renters", "policy_type", "Contents / renters"],
    ["life_insurance", "Life", "policy_type", "Life"], ["health_insurance", "Health / dental", "policy_type", "Health / dental"], ["travel_insurance", "Travel", "policy_type", "Travel"], ["pet_insurance", "Pet", "policy_type", "Pet"], ["other_insurance", "Other insurance", "policy_type", "Other"],
  ] },
  { id: "transport", label: "Transport", category_id: "transport_vehicle", types: [
    ["vehicle_finance", "Vehicle finance", "finance_type", "Vehicle finance"], ["vehicle_tax", "Vehicle tax / registration", "service_type", "Vehicle tax / registration"], ["ev_charging", "EV charging", "service_type", "EV charging"],
    ["fuel", "Fuel", "service_type", "Fuel"], ["parking", "Parking", "service_type", "Parking"], ["tolls", "Tolls / road charges", "service_type", "Tolls / road charge"], ["public_transport", "Public transport", "service_type", "Public transport"],
  ] },
  { id: "loans_credit", label: "Loans and credit", category_id: "credit_loans_finance", types: [
    ["credit_card", "Credit card", "finance_type", "Credit card"], ["personal_loan", "Personal loan", "finance_type", "Personal loan"], ["student_loan", "Student loan", "finance_type", "Student loan"],
    ["bnpl", "Buy now, pay later", "finance_type", "Buy now, pay later"], ["bank_fees", "Overdraft / bank fees", "finance_type", "Overdraft / bank fees"],
  ] },
  { id: "family_care", label: "Family, health and care", category_id: "family_childcare_education", types: [
    ["childcare", "Childcare", "service_type", "Childcare"], ["school_fees", "School fees", "service_type", "School fees"], ["school_meals_transport", "School meals / transport", "service_type", "School meals / transport"],
    ["tutoring", "Tuition / tutoring", "service_type", "Tuition"], ["elder_care", "Elder care", "service_type", "Elder care"], ["health_plan", "Health / dental plan", "service_type", "Medical"],
    ["prescription_plan", "Prescription plan", "service_type", "Prescription plan"], ["vet_plan", "Vet / pet-care plan", "service_type", "Vet / pet care"],
  ] },
  { id: "subscriptions", label: "Subscriptions and memberships", category_id: "subscriptions_memberships", types: [
    ["video_music", "Video / music", "service_type", "Streaming"], ["gaming", "Gaming", "service_type", "Gaming"], ["software_cloud", "Software / cloud storage", "service_type", "Software / cloud storage"],
    ["news", "Newspaper / magazine", "service_type", "News / publishing"], ["gym", "Gym / fitness", "service_type", "Gym / fitness"], ["club", "Club membership", "service_type", "Club"],
    ["delivery", "Delivery membership", "service_type", "Shopping membership"], ["charity", "Regular charity donation", "service_type", "Regular charity donation"],
  ] },
  { id: "other", label: "Other or not sure", category_id: "other_regular_payment", types: [["other_regular", "Other / unrecognised regular payment", "service_type", "Other regular payment"]] },
];
export const billGroups = groups.map(group => ({ ...group, types: group.types.map(([id, label, detail_key, detail_value]) => ({ id, label, detail_key, detail_value, category_id: ({ water: "water", sewerage: "water", water_sewerage: "water", property_rates: "council_tax_licences", tv_licence: "council_tax_licences", elder_care: "health_care_pets", health_plan: "health_care_pets", prescription_plan: "health_care_pets", vet_plan: "health_care_pets" })[id] || group.category_id })) }));
export function groupForCategory(categoryId) { return billGroups.find(group => group.category_id === categoryId) || (categoryId === "water" ? billGroups[0] : undefined); }
export function resolveBillType(task) {
  const details = task?.details || {};
  const categoryId = task?.category_id || task?.category;
  for (const group of billGroups) {
    const type = group.types.find(item => item.id === details.bill_type_id) || group.types.find(item => item.detail_key && details[item.detail_key] === item.detail_value && (group.category_id === categoryId || item.category_id === categoryId));
    if (type && (!categoryId || group.category_id === categoryId || type.category_id === categoryId || group.category_id === task.category)) return { group, type };
  }
  return null;
}
