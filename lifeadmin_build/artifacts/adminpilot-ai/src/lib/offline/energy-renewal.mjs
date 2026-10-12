// Local counterpart of energy_renewal.py. Supplied prices are not treated as
// comparable until billing periods are confirmed; no live tariffs are fetched.
export function renewalSections(task) {
  const details = task?.details && !Array.isArray(task.details) && typeof task.details === "object" ? task.details : {};
  const value = (key, fallback = "not supplied") => String(details[key] || fallback).trim();
  const provider = value("provider", "the supplier");
  const reference = value("account_reference", "");
  const supply = value("utility_type");
  const usage = value("annual_usage");
  const tariff = value("tariff");
  const rate = value("unit_rate");
  const standing = value("standing_charge");
  const current = value("current_price", details.amount || "not supplied");
  const currentPeriod = value("current_price_frequency");
  const quote = value("new_quote");
  const quotePeriod = value("renewal_quote_frequency");
  const incomplete = [currentPeriod, quotePeriod].some(x => ["not supplied", "not sure"].includes(x.toLowerCase()));
  const date = value("renewal_date", details.date || "not supplied");
  const exit = value("exit_fee");
  const priority = value("renewal_priority");
  const switching = value("switch_willingness");
  return {
    next_steps: [
      "1. Confirm " + provider + "'s renewal date, price frequency and tariff terms.",
      "2. Rank options against the stated renewal priority: " + priority + ".",
      "3. Apply the switching preference when comparing stay, retention and switch options: " + switching + ".",
      "4. Use the supplied annual usage for each like-for-like comparison: " + usage + ".",
      "5. Convert current and renewal prices to the same annual basis using the confirmed price frequencies before comparing them.",
      "6. For dual fuel, calculate electricity and gas separately before adding annual costs.",
      "7. Compare first-year cost after applicable exit fees with ongoing annual cost.",
      "8. Mark the comparison incomplete when usage, rates, standing charges or price frequency are missing or marked Not sure.",
    ].join("\n"),
    provider_message:
      "Hello " + provider + ", I am reviewing my upcoming renewal." +
      (reference ? " My account/customer reference is " + reference + "." : "") +
      (priority !== "not supplied" ? " My main priority is " + priority + "." : "") +
      (switching !== "not supplied" ? " My switching preference is " + switching + "." : "") +
      (current !== "not supplied" ? " My current price is " + current + (currentPeriod !== "not supplied" ? " (" + currentPeriod + ")." : ".") : "") +
      (quote !== "not supplied" ? " My renewal quote is " + quote + (quotePeriod !== "not supplied" ? " (" + quotePeriod + ")." : ".") : "") +
      (date !== "not supplied" ? " My renewal date is " + date + "." : "") +
      " Please confirm my current tariff name and type, annual usage, current unit rate(s), standing charge(s), tariff end or renewal date, renewal tariff and any exit fee in writing. Please also confirm the billing period for both my current price and renewal quote.",
    things_to_check: [
      "- Supply type: " + supply + ". Current tariff: " + tariff + ".",
      "- Unit rates supplied: " + rate + ". Standing charges supplied: " + standing + ".",
      "- Current price: " + current + ". Current price frequency: " + currentPeriod + ".",
      "- Renewal quote: " + quote + ". Renewal quote frequency: " + quotePeriod + ".",
      incomplete ? "- Price-period comparison: incomplete until both current and renewal price frequencies are confirmed." : "- Price-period comparison: ready for same-period annualisation.",
      "- Renewal date: " + date + ". Exit fees: " + exit + ".",
      "- Renewal priority: " + priority + ". Switching preference: " + switching + ".",
      "- Electricity or gas annual tariff cost = annual kWh x unit rate + 365 x daily standing charge.",
      "- Dual fuel annual cost = electricity annual cost + gas annual cost.",
      "- First-year switch cost = alternative annual tariff cost + applicable exit fees.",
      "- First-year saving = comparable current or renewal annual cost - first-year switch cost.",
      "- Ongoing annual saving = comparable current or renewal annual cost - alternative annual tariff cost.",
    ].join("\n"),
    approval_checklist: [
      "- Electricity and gas figures separated for dual fuel.",
      "- Current and renewal price frequency confirmed and converted to the same comparison period.",
      "- First-year saving checked after exit fees.",
      "- Ongoing annual saving checked without one-off exit fees.",
      "- Supplier, dates and tariff terms reviewed before any switch or renewal is approved.",
      "- Final choice reflects the stated renewal priority and switching preference.",
    ].join("\n"),
  };
}
