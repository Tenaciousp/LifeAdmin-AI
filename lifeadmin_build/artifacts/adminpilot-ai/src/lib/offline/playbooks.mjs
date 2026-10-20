import data from "./playbooks.json" with { type: "json" };

function render(value, values = {}) {
  if (Array.isArray(value)) return value.map(item => render(item, values));
  return value.replace(/__LIFEADMIN_([A-Z_]+)__/g, (token, key) => values[key] ?? token);
}

const routes = {
  tv_broadband_mobile: "communications", energy_water: "utilities", council_tax_licences: "council_tax",
  insurance: "insurance", subscriptions_memberships: "streaming", rent_mortgage_property: "housing_payment",
  credit_loans_finance: "credit_payment", home_security_maintenance: "home_services",
  transport_vehicle: "transport", health_care_pets: "health_care_pets", family_childcare_education: "family_services",
};

function route(task, canonical) {
  if (routes[canonical.category_id]) return routes[canonical.category_id];
  const raw = [task.title || "", task.notes || ""].join(" ");
  const text = " " + raw.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim() + " ";
  const scores = Object.fromEntries(Object.entries(data.signals).map(([key, phrases]) =>
    [key, phrases.filter(phrase => text.includes(" " + phrase + " ")).length]));
  if (/\bNOW\b/.test(raw)) scores.streaming += 1;
  const legacy = data.legacy_category_routes[String(task.category || "").toLowerCase()];
  if (legacy) scores[legacy] += 1;
  let best = null;
  for (const [key, score] of Object.entries(scores)) {
    if (key !== "bill" && score > (scores[best] || 0)) best = key;
  }
  return best || (scores.bill ? "bill" : "general");
}

function noteValue(task, ...labels) {
  const wanted = labels.map(x => x.toLowerCase());
  for (const line of String(task.notes || "").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon >= 0 && wanted.includes(line.slice(0, colon).trim().toLowerCase()) && line.slice(colon + 1).trim()) {
      return line.slice(colon + 1).trim();
    }
  }
  return "";
}

function subscription(task, canonical) {
  const d = canonical.details;
  const provider = String(d.provider || noteValue(task, "Provider", "Provider or membership") || "").trim();
  if (!provider) return null;
  const billed = String(d.billing_route || noteValue(task, "Billed through") || "").trim();
  const payment = String(d.amount || noteValue(task, "Current payment", "Current monthly or annual payment") || "").trim();
  const renewal = String(d.next_payment_date || d.date || noteValue(task, "Next payment", "Next payment or renewal date") || "").trim();
  const goal = ["cancel_switch", "challenge_charge"].includes(canonical.goal_id) ? canonical.goal_id : "check_bill";
  const cancellation = data.cancellation[provider.toLowerCase()] ||
    "Open the official " + provider + " account or billing page and confirm the cancellation route before acting.";
  const sections = render(data.named[goal], { PROVIDER: provider, CANCELLATION_ROUTE: cancellation });
  const supplied = [
    "- Provider: " + provider + ".",
    payment ? "- Current payment: " + payment + "." : "- Confirm the current price and billing frequency.",
    renewal ? "- Next payment or renewal: " + renewal + "." : "- Confirm the next payment or renewal date.",
  ];
  if (billed) supplied.push("- Billing route supplied: " + billed + ".");
  const context = [];
  for (const [key, label] of [
    ["account_reference", "Account or customer reference"], ["payment_description", "Payment or bill description"],
    ["what_happened", "Issue supplied"], ["minimum_term_end", "Minimum term ends"],
    ["confirmation_received", "Cancellation confirmation supplied"],
  ]) {
    const value = String(d[key] || "").trim();
    if (value) { supplied.push("- " + label + ": " + value); context.push(label + ": " + value); }
  }
  for (const [label, value] of [["Current payment", payment], ["Next payment or renewal", renewal], ["Billing route supplied", billed]]) {
    if (value) context.push(label + ": " + value);
  }
  sections[0][1] = supplied;
  if (context.length) sections[3][1][0] += "\n\n" + context.join("\n");
  return sections;
}

function sectionsFor(playbook, task, canonical) {
  const d = canonical.details;
  const provider = String(d.provider || "the provider").trim();
  const goal = canonical.goal_id;
  if (playbook === "communications" && data.communications[goal]) {
    const sections = render(data.communications[goal], { PROVIDER: provider });
    for (const [key, label] of [
      ["account_reference", "Account or customer reference"], ["amount", "Current amount"],
      ["previous_amount", "Previous amount"], ["date", "Relevant date"], ["what_happened", "Issue supplied"],
    ]) if (d[key]) {
      sections[0][1].push("- " + label + ": " + d[key] + ".");
      sections[2][1][0] += "\n\n" + label + ": " + d[key];
    }
    return sections;
  }
  if (playbook === "streaming") {
    const named = subscription(task, canonical);
    if (named) return named;
  }
  if (playbook === "credit_payment" && goal === "challenge_charge") return render(data.credit_challenge, { AMOUNT: d.amount || "the charge", DATE: d.date || "the statement date" });
  if (playbook === "council_tax" && goal === "challenge_charge") return render(data.council_challenge);
  return render(data.base[playbook] || [], { PROVIDER: provider });
}

export function playbookText(task, canonical, mode = "full") {
  const playbook = route(task, canonical);
  const notes = task.notes || "";
  if (playbook === "general") return render(data.general[notes ? "with_notes" : "without_notes"], { TITLE: task.title ?? "Admin task", NOTES: notes });
  const lines = [];
  if (notes) lines.push("## Information supplied", notes, "");
  const title = playbook.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join("_");
  lines.push("## Task-specific playbook: " + title, "Use this checklist as a working plan. Confirm provider terms and approve every real-world action.", "");
  for (const [heading, items] of [...sectionsFor(playbook, task, canonical), ...render(data.modes[mode] || [])]) {
    lines.push("## " + heading, ...items, "");
  }
  return lines.join("\n").trimEnd();
}

export function structuredResult(text) {
  const buckets = { next_steps: [], provider_message: [], things_to_check: [], approval_checklist: [] };
  const matches = [...text.matchAll(/^(#{1,3})\s+(.+?)\s*$/gm)];
  if (!matches.length) buckets.next_steps.push(text.trim());
  else {
    const intro = text.slice(0, matches[0].index).trim();
    if (intro) buckets.next_steps.push(intro);
    matches.forEach((match, index) => {
      const heading = match[2].trim();
      const name = heading.toLowerCase();
      if (data.headings.OMITTED_RESULT_HEADINGS.includes(name) || name.startsWith("task-specific playbook:")) return;
      const body = text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length).trim();
      const content = ("## " + heading + "\n" + body).trim();
      const bucket = data.headings.PROVIDER_MESSAGE_HEADINGS.includes(name) ? "provider_message" :
        data.headings.APPROVAL_HEADINGS.includes(name) ? "approval_checklist" :
        data.headings.THINGS_TO_CHECK_HEADINGS.includes(name) ? "things_to_check" : "next_steps";
      buckets[bucket].push(content);
    });
  }
  return Object.fromEntries(Object.entries(buckets).map(([key, parts]) => [key, parts.filter(Boolean).join("\n\n").trim()]));
}
