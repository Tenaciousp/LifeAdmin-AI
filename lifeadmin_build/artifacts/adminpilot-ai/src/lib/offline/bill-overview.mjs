import { validDiaryDate } from "./diary.mjs";

export const countries = ["United Kingdom", "United States", "Canada", "Australia", "New Zealand", "Ireland", "France", "Germany", "India", "South Africa", "Singapore", "United Arab Emirates", "Other country / region"];
const currencyFallback = ["GBP", "USD", "EUR", "CAD", "AUD", "NZD", "INR", "ZAR", "SGD", "AED", "CHF", "JPY", "CNY", "HKD", "BRL", "MXN", "SEK", "NOK", "DKK", "PLN", "KRW", "IDR", "MYR", "PHP", "THB", "TRY", "SAR"];
export const currencies = typeof Intl.supportedValuesOf === "function" ? [...new Set([...currencyFallback, ...Intl.supportedValuesOf("currency")])] : currencyFallback;
export const frequencies = ["Weekly", "Fortnightly", "Four-weekly", "Monthly", "Quarterly", "Six-monthly", "Yearly", "One bill", "Not sure"];
const monthlyFactors = { Weekly: 52 / 12, Fortnightly: 26 / 12, "Four-weekly": 13 / 12, Monthly: 1, Quarterly: 1 / 3, "Six-monthly": 1 / 6, Yearly: 1 / 12 };

// Only explicitly entered numeric amounts and currencies qualify. Never infer a
// currency from an ambiguous symbol or combine currencies without an FX source.
export function recurringCost(task) {
  const d = task.details || {};
  const raw = String(d.amount || "").trim();
  const factor = monthlyFactors[d.billing_frequency];
  if (!/^\d+(\.\d{1,3})?$/.test(raw) || !currencies.includes(d.currency) || !factor) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount > 1e12) return null;
  return { currency: d.currency, amount, monthly: amount * factor, yearly: amount * factor * 12 };
}
export function money(amount, currency) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2 }).format(amount);
}
export function billOverview(tasks, today = new Date().toLocaleDateString("en-CA")) {
  const active = tasks.filter(task => task.status !== "Done");
  const totals = new Map();
  let priced = 0;
  for (const task of active) {
    const cost = recurringCost(task);
    if (!cost) continue;
    priced++;
    const total = totals.get(cost.currency) || { currency: cost.currency, monthly: 0, yearly: 0 };
    total.monthly += cost.monthly; total.yearly += cost.yearly;
    totals.set(cost.currency, total);
  }
  const upcoming = active.flatMap(task => {
    const d = task.details || {};
    return [["Payment", d.next_payment_date], ["Renewal", d.renewal_date], ["Contract expiry", d.contract_expiry], ["Notice deadline", d.notice_deadline], ["Follow-up", d.follow_up_date]].filter(([, date]) => validDiaryDate(date)).map(([kind, date]) => ({ task, kind, date, overdue: date < today }));
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { active: active.length, priced, unpriced: active.length - priced, totals: [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)), upcoming };
}

// Sort display copies only; saved records and currency values are never changed.
export function sortBills(tasks, order = "next_date") {
  const nextDate = task => ["next_payment_date", "renewal_date", "contract_expiry", "notice_deadline", "follow_up_date"]
    .map(key => task.details?.[key]).filter(validDiaryDate).sort()[0] || "9999-12-31";
  const byName = (a, b) => String(a.title || "").localeCompare(String(b.title || "")) || String(a.id).localeCompare(String(b.id));
  return [...tasks].sort((a, b) => {
    if (order === "name") return byName(a, b);
    if (order === "cost") {
      const left = recurringCost(a), right = recurringCost(b);
      if (!left || !right) return left ? -1 : right ? 1 : byName(a, b);
      return left.currency.localeCompare(right.currency) || right.monthly - left.monthly || byName(a, b);
    }
    return nextDate(a).localeCompare(nextDate(b)) || byName(a, b);
  });
}
