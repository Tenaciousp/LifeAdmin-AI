import bundledCatalog from "./catalog.json" with { type: "json" };

// No request, account, device identifier or analytics event is needed to route a bill.
export function catalog() {
  return structuredClone(bundledCatalog);
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+£$.-]+/g, " ").trim();
}

export function suggest(query) {
  const text = normalise(query);
  const popular = bundledCatalog.categories.filter(x => x.popular).map(x => x.id);
  if (!text) return {
    category_id: null, goal_id: null, category: null, goal: null,
    confidence: 0, reasons: [], popular_categories: popular,
  };
  const matches = phrase => {
    const value = normalise(phrase);
    if (!value) return false;
    const escaped = value.replace(/[.*+?^${()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    return new RegExp("(?:^|[^a-z0-9])" + escaped + "(?:$|[^a-z0-9])").test(text);
  };
  const scores = items => {
    const result = new Map();
    for (const item of items) {
      const found = item.synonyms.filter(matches);
      if (found.length) result.set(item.id, found.reduce((sum, phrase) => sum + normalise(phrase).split(" ").length + 1, 0));
    }
    return result;
  };
  const categoryScores = scores(bundledCatalog.categories);
  const goalScores = scores(bundledCatalog.goals);
  if (categoryScores.get("tv_broadband_mobile") && [" price", "price ", "cost", "expensive"].some(x => text.includes(x))) {
    goalScores.set("reduce_price", Math.max(goalScores.get("reduce_price") || 0, 5));
  }
  if (["unknown", "unrecognised", "unrecognized", "mystery", "do not recognise"].some(x => text.includes(x)) &&
      ["payment", "charge", "card", "direct debit", "bank"].some(x => text.includes(x))) {
    goalScores.set("identify_payment", Math.max(goalScores.get("identify_payment") || 0, 10));
    if (!categoryScores.size || Math.max(...categoryScores.values()) <= 3) categoryScores.set("other_regular_payment", 9);
  }
  const best = values => {
    let chosen = null;
    let maximum = -1;
    for (const [id, score] of values) if (score > maximum) { chosen = id; maximum = score; }
    return chosen;
  };
  const categoryId = best(categoryScores);
  let goalId = best(goalScores);
  if (!goalId) {
    const fallbacks = [
      ["prepare_renewal", ["renewal", "renew", "expires", "expiry", "ending"]],
      ["cancel_switch", ["cancel", "switch", "leave", "stop paying", "terminate"]],
      ["challenge_charge", ["wrong", "dispute", "challenge", "complaint", "refund", "overcharged"]],
      ["reduce_price", ["too expensive", "cheaper", "discount", "better deal", "price rise"]],
      ["check_bill", ["payment", "bill", "fees", "fee", "price", "cost", "charge"]],
    ];
    goalId = fallbacks.find(([, words]) => words.some(word => text.includes(word)))?.[0] || null;
  }
  const providers = {
    tv_broadband_mobile: [["virgin media", "Virgin Media"], ["sky", "Sky"], ["bt", "BT"], ["ee", "EE"], ["vodafone", "Vodafone"], ["o2", "O2"]],
    insurance: [["direct line", "Direct Line"], ["admiral", "Admiral"], ["aviva", "Aviva"], ["axa", "AXA"]],
    subscriptions_memberships: [["netflix", "Netflix"], ["spotify", "Spotify"], ["disney+", "Disney+"], ["amazon prime", "Amazon Prime"]],
    energy_water: [["octopus", "Octopus Energy"], ["british gas", "British Gas"], ["e.on", "E.ON"], ["eon", "E.ON"], ["edf", "EDF"], ["ovo", "OVO"], ["scottishpower", "ScottishPower"], ["utilita", "Utilita"], ["united utilities", "United Utilities"], ["thames water", "Thames Water"], ["yorkshire water", "Yorkshire Water"], ["severn trent", "Severn Trent"]],
  };
  const details = {};
  const provider = (providers[categoryId] || []).find(([phrase]) => matches(phrase))?.[1] || "";
  if (provider) details.provider = provider;
  if (categoryId === "energy_water") {
    if (["United Utilities", "Thames Water", "Yorkshire Water", "Severn Trent"].includes(provider) || matches("water")) {
      details.utility_type = "Water"; details.tariff = "Water tariff";
    } else if (matches("dual fuel")) details.utility_type = "Dual fuel";
    else if (matches("electricity")) details.utility_type = "Electricity";
    else if (matches("gas") && provider !== "British Gas") details.utility_type = "Gas";
  }
  const reasons = [];
  if (categoryId) reasons.push("Matched " + bundledCatalog.categories.find(x => x.id === categoryId).label.toLowerCase() + ".");
  if (goalId) reasons.push("Matched the goal ‘" + bundledCatalog.goals.find(x => x.id === goalId).label.toLowerCase() + "’.");
  const score = (categoryScores.get(categoryId) || 0) + (goalScores.get(goalId) || 0);
  return {
    category_id: categoryId, goal_id: goalId, category: categoryId, goal: goalId,
    confidence: categoryId || goalId ? Math.min(0.98, Math.round((0.38 + 0.07 * score) * 100) / 100) : 0,
    reasons, prefill_details: details, popular_categories: popular,
  };
}
