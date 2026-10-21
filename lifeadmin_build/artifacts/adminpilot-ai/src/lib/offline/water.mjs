// Household water guidance. Verify current regional and company rules before acting.
// Sources: ofwat.gov.uk/households/your-water-bill/ and ccw.org.uk.
export function waterResult(task) {
  const d = task.details;
  const provider = String(d.provider || "my water company").trim();
  const routes = {
    check_bill: ["Check my water bill", "Compare the bill dates, water and sewerage charges, and any balance carried forward. Separate the bill total from a monthly payment towards that total.", "Please explain how my water and sewerage bill was calculated, including the billing period, charges and any balance carried forward."],
    reduce_price: ["Review my water costs", "Ask the company to review the charging basis and any available support or allowances. Compare a meter estimate using household occupancy and actual charges before choosing a change.", "Please review my current charging basis and explain any metered, assessed-charge, support or allowance options relevant to my home. Please provide an estimate before making any change."],
    water_meter: ["Water meter enquiry", "Check your region's metering rules and use the company's or CCW's water-meter calculator with your household size and current annual charge. Ask about installation suitability and any trial or switch-back conditions before deciding.", "Please explain whether a meter is suitable for my home, the estimated annual cost compared with my current charges, and the installation, trial and switch-back conditions."],
    water_usage: ["High water use or possible leak", "Check whether the bill uses actual or estimated readings and compare the meter number, readings and dates. Ask the company for safe leak-check instructions and its leakage-allowance process; report an active leak through its official route.", "Please review the high usage on my bill, confirm the meter number and readings used, and explain the next checks and any leakage allowance relevant to my circumstances."],
    water_support: ["Help paying my water bill", "Contact the company before a missed payment where possible. Ask about affordable payment arrangements and eligibility for support schemes or social tariffs in your region. Eligibility requires the company's assessment.", "I need help managing my water payments. Please explain affordable payment arrangements and support schemes relevant to my home, including the eligibility checks and information you need."],
    challenge_charge: ["Water charge or meter-reading query", "Identify the particular charge or reading in question. Keep a copy of the bill and dated readings or photos where safe. Ask for an explanation or correction and retain the complaint reference.", "Please investigate the charge or meter reading described below, explain the calculation and correct any confirmed error. Please provide a reference and expected response date."],
    contact_provider: ["Water account enquiry", "Summarise the question and the response you need. Use the company's official contact details on your bill and retain its response.", "Please help with the water-account question below and confirm the next steps."],
  };
  const [subject, action, request] = routes[task.goal_id] || routes.check_bill;
  const unmetered = ["Unmetered / rateable value", "Assessed charge", "Included in council tax / rates"].includes(d.billing_basis);
  const facts = [
    ["Current amount", d.amount], ["Payment frequency", d.billing_frequency], ["Region", d.water_region],
    ["Charging basis", d.billing_basis], ["Services billed", d.water_services], ["Household", d.household_size],
    ["Bill period", d.bill_period], ["Reading basis", d.reading_basis], ["Meter reading", d.meter_reading],
    ["Water usage", d.water_usage], ["Previous amount", d.previous_amount], ["Customer reference", d.account_reference],
    ["Question or issue", d.what_happened], ["Additional notes", task.notes],
  ].filter(([label, value]) => String(value || "").trim() && !(unmetered && ["Reading basis", "Meter reading", "Water usage"].includes(label))).map(([label, value]) => label + ": " + value);
  const regional = d.water_region === "Scotland"
    ? "For Scotland, check the water and wastewater charges on your council tax bill and Scottish Water's household guidance before comparing options."
    : d.water_region === "Northern Ireland"
    ? "For Northern Ireland, check NI Water's domestic charging guidance and whether the charge concerns a household, private supply or another service before applying advice about separate water bills."
    : ["England", "Wales"].includes(d.water_region)
    ? "For households in England and Wales, water supply is determined by the property; review charging arrangements, usage and support with the existing company."
    : "Confirm the country or region first. Household water billing, metering and support arrangements differ by location.";
  const message = "Hello,\n\n" + request + (facts.length ? "\n\n" + facts.join("\n") : "") + "\n\nPlease explain the options before changing my account or payments.\n\nThank you.";
  return {
    next_steps: "1. " + regional + "\n2. " + action + "\n3. Review the response and decide the next action yourself.",
    things_to_check: (facts.length ? facts.map(line => "- " + line).join("\n") + "\n\n" : "") + "- Confirm the company, region, charging basis and payment frequency.\n- Water and sewerage might appear on separate bills.\n- Estimates and support eligibility need confirmation through the company.\n- Official guidance: https://www.ofwat.gov.uk/households/your-water-bill/ and https://www.ccw.org.uk/.",
    approval_checklist: "- Check every supplied amount, date and reading.\n- Use official contact details from your bill or the company's website.\n- Approve any meter installation, account change or payment arrangement yourself.\n- If payments are unaffordable, contact the company and a qualified debt-advice service before changing payments.",
    provider_message: message,
    provider_email: { subject: Array.from(subject + " - " + provider).slice(0, 140).join(""), body: message, kind: "provider" },
  };
}
