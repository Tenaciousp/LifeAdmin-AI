import { catalog } from "./domain.mjs";
import { renewalSections } from "./energy-renewal.mjs";

const catalogue = catalog();
const categories = new Map(catalogue.categories.map(x => [x.id, x]));
const goals = new Map(catalogue.goals.map(x => [x.id, x]));
const cut = (text, length) => Array.from(text).slice(0, length).join("");
const legacy = {
  "TV, broadband or phone": "tv_broadband_mobile",
  "Gas, electricity or water": "energy_water",
  "Council tax": "council_tax_licences",
  "Subscriptions and memberships": "subscriptions_memberships",
  "Other household bill or renewal": "other_regular_payment",
  "Renewal": "other_regular_payment", other_payment: "other_regular_payment",
};

export function normaliseTask(task) {
  const original = task?.details && !Array.isArray(task.details) && typeof task.details === "object" ? task.details : {};
  const details = Object.fromEntries(Object.entries(original).filter(([, value]) => value !== null && value !== "").map(([key, value]) => {
    if (!["string", "number", "boolean"].includes(typeof value)) throw new Error("Bill details must contain text or numbers.");
    const text = typeof value === "boolean" ? (value ? "True" : "False") : String(value);
    return [cut(key, 80), cut(text, 500)];
  }));
  const requested = task.category_id || task.category || "other_regular_payment";
  const mapped = legacy[requested] || requested;
  const category = categories.has(mapped) ? mapped : "other_regular_payment";
  const goal = goals.has(task.goal_id) ? task.goal_id : "check_bill";
  return { ...task, details, category_id: category, goal_id: goal, category: categories.get(category).label };
}

export function missingDetails(task) {
  const canonical = normaliseTask(task);
  const fields = new Map();
  for (const field of [...categories.get(canonical.category_id).fields, ...goals.get(canonical.goal_id).fields]) {
    fields.set(field.id, { ...fields.get(field.id), ...field });
  }
  return [...new Set([...fields.values()].filter(field =>
    (field.required || field.recommended) && !canonical.details[field.id]).map(field => field.label))].slice(0, 6);
}

export function safetyNotices(task) {
  const canonical = normaliseTask(task);
  const text = JSON.stringify(canonical).toLowerCase();
  const has = terms => terms.some(term => text.includes(term));
  const notices = [];
  if (has(["fraud", "fraudulent", "unauthorised", "unauthorized", "stolen card", "scam"])) notices.push(
    "If you suspect fraud or an unauthorised payment, use the bank or card provider's official fraud channel promptly. Do not share passwords, PINs, one-time codes or full card details.");
  if (canonical.category_id === "energy_water" && has(["arrears", "debt", "disconnection", "disconnect", "cannot pay", "can't pay", "afford"])) notices.push(
    "If you are struggling to pay or facing disconnection, contact the supplier through its official support route and seek qualified debt or energy-support guidance before stopping payments.");
  if (canonical.category_id === "rent_mortgage_property" && has(["eviction", "evict", "repossession", "repossess", "arrears", "notice to quit", "section 8", "section 21"])) notices.push(
    "If eviction or repossession is a risk, contact the landlord or lender through an official route and obtain qualified housing or debt advice promptly. Do not rely on this plan as legal advice.");
  if (canonical.category_id === "insurance" && has(["emergency", "urgent claim", "accident", "flood", "fire", "theft"])) notices.push(
    "For an urgent insurance incident, use the insurer's official claims or emergency route and follow any time-sensitive policy instructions.");
  return notices;
}

function unknownPayment(task) {
  const details = task.details;
  const description = details.statement_description || details.payment_description || "the payment shown on my statement";
  const amount = details.amount || "the amount shown";
  const date = details.date || "the date shown";
  return {
    next_steps: "1. Check whether the payment is pending or fully posted, and note the description, amount and date.\n2. Search email receipts and subscription lists, including Apple, Google Play, Amazon and PayPal.\n3. Ask household members whether they recognise it without sharing card, login or security details.\n4. If it remains unrecognised, contact the bank or card provider using its official app, website or phone number.",
    provider_message: "",
    things_to_check: "- Statement description: " + description + ".\n- Amount and date: " + amount + "; " + date + ".\n- Check whether it repeats monthly or annually.\n- Check Apple, Google Play, Amazon, PayPal and household accounts.\n- Do not cancel an essential payment until you understand what it is.\n- Never share passwords, full card numbers or one-time codes.",
    approval_checklist: "- Confirm the payment is posted before disputing it.\n- Use only the official bank or card-provider contact route.\n- Keep a note of the date, amount and statement description.\n- Approve any dispute, payment cancellation or replacement-card action yourself.",
    provider_email: {
      subject: "Query about an unrecognised payment",
      body: "Hello,\n\nI am trying to identify a payment shown as ‘" + description + "’ for " + amount + " on " + date + ". I do not recognise it. Please confirm what merchant or payment information you can provide, whether it is pending or posted, and the safest next step if I still do not recognise it.\n\nThank you.",
      kind: "bank_query",
    },
  };
}

export function generateLocalResult(input) {
  const task = normaliseTask(input);
  const raw = [task.title || "", task.notes || "", task.details.payment_description || "", task.details.statement_description || ""]
    .join(" ").toLowerCase().replace(/[^a-z0-9+£$.-]+/g, " ").trim();
  const unknown = task.goal_id === "identify_payment" || (task.category_id === "other_regular_payment" &&
    ["unknown", "unrecognised", "unrecognized", "mystery", "do not recognise"].some(term => raw.includes(term)));
  let sections;
  let content;
  if (unknown) {
    sections = unknownPayment(task);
    content = ["# Admin plan: " + (task.title ?? "Unknown payment"), "## Next steps\n" + sections.next_steps,
      "## Things to check\n" + sections.things_to_check, "## Approval checklist\n" + sections.approval_checklist].join("\n\n");
  } else if (task.category_id === "energy_water" && task.goal_id === "prepare_renewal" &&
      (task.details.utility_type || "").trim().toLowerCase() !== "water" &&
      (task.details.tariff || "").trim().toLowerCase() !== "water tariff") {
    const generated = renewalSections(task);
    const headings = { next_steps: "Next steps", provider_message: "Provider message", things_to_check: "Things to check", approval_checklist: "Approval checklist" };
    sections = Object.fromEntries(Object.entries(headings).map(([key, heading]) => [key, "## " + heading + "\n" + generated[key]]));
    content = Object.values(sections).join("\n\n");
    const provider = String(task.details.provider || "Provider").trim();
    sections.provider_email = { subject: cut(provider + " renewal review", 140), body: generated.provider_message.trim(), kind: "provider" };
  } else {
    // Never silently send unsupported local planning to the hosted API.
    throw new Error("This planning route has not yet been migrated to local generation.");
  }
  sections.known_details = { ...task.details };
  sections.missing_details = missingDetails(task);
  const notices = safetyNotices(task);
  if (notices.length) sections.things_to_check = (sections.things_to_check.trim() + "\n\n## Safety check\n" + notices.map(x => "- " + x).join("\n")).trim();
  return { content, ...sections };
}

export async function generateAndSaveLocalPlan(store, taskId) {
  const snapshot = await store.read();
  const task = snapshot.tasks.find(item => item.id === taskId);
  if (!task) throw new Error("Bill not found.");
  const result = generateLocalResult(task);
  const note = {
    id: globalThis.crypto.randomUUID(), task_id: task.id, title: task.title,
    source: "local", created_at: new Date().toISOString(), content: result.content,
    sections: Object.fromEntries(["next_steps", "provider_message", "things_to_check", "approval_checklist"].map(key => [key, result[key]])),
    provider_email: result.provider_email, known_details: result.known_details, missing_details: result.missing_details,
  };
  await store.savePlan(note);
  return note;
}
