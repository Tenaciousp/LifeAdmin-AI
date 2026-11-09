import { money } from "./lib/offline/bill-overview.mjs";

function section(text: string, names: RegExp): string {
  const lines = text.split("\n");
  const first = lines.findIndex(line => {
    const heading = line.trim().match(/^#{1,4}\s+(?:\d+[.):]\s*)?(.+)$/);
    return Boolean(heading && names.test(heading[1].trim()));
  });
  if (first < 0) return "";
  let end = lines.length;
  for (let i = first + 1; i < lines.length; i++) {
    if (/^\s*#{1,4}\s+\S/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(first + 1, end).join("\n").trim();
}

export default function PlanResultSummary({ plan, savedCost }: { plan: string; savedCost?: { monthly: number; yearly: number; currency: string } | null }) {
  const bill = section(plan, /^(?:My bill at a glance|Current bill|Current cost)$/i);
  const recommendation = section(plan, /^(?:Best next action|My first next step|Recommended action)$/i);
  const alternatives = section(plan, /^(?:Alternatives to consider|Comparison of alternatives|Provider comparison)$/i);
  const actionList = section(plan, /^(?:My action list|Action list|Next steps)$/i);
  const estimatedSavings = section(plan, /^(?:Estimated savings|Estimated saving|Potential savings|Potential saving)$/i);
  const customerChecked = /Savings comparison \(customer-checked source, not independently verified by HomeAdmin\)/i.test(plan);
  const reviewedDifferences = customerChecked ? [...plan.matchAll(/(\d{1,2})-month difference: ([^\n]{1,100}) \((saving|additional cost)\)/gi)].slice(0, 3).map((match) => ({ months: match[1], value: match[2], direction: match[3] })) : [];
  const hasSourceEvidence = /https:\/\/[^\s)\]]+/i.test(alternatives) && /(?:checked|verified|as of|accessed)\s*(?:on\s*)?\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}/i.test(alternatives);
  if (!recommendation && !alternatives) {
    return <section aria-label="AI result overview" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="font-bold text-amber-950">Recommendation needs review</h4>
      {savedCost && <p className="mt-2 font-semibold">Your saved cost: {money(savedCost.monthly, savedCost.currency)} per month · {money(savedCost.yearly, savedCost.currency)} per year. Entered by you, not provider-verified.</p>}
      {actionList && <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3"><h5 className="font-bold">Actions included in the answer</h5><p className="mt-2 whitespace-pre-wrap break-words">{actionList}</p></div>}
      <p className="mt-2 text-sm text-amber-950">The AI answer has no clearly labelled recommendation or comparison. Read the full plan below and request a clearer answer before relying on savings claims.</p>
    </section>;
  }
  return <section aria-label="AI result overview" className="rounded-xl border border-violet-200 bg-white p-4">
    <h4 className="text-lg font-bold text-violet-950">Your AI results at a glance</h4>
    {savedCost && <div className="mt-3 rounded-xl border border-slate-200 p-3"><h5 className="font-bold">Your saved current cost</h5><p className="mt-1 text-sm text-slate-700">Calculated from the amount, currency and billing frequency you entered. Not a provider-verified charge.</p><p className="mt-2 font-semibold">{money(savedCost.monthly, savedCost.currency)} per month · {money(savedCost.yearly, savedCost.currency)} per year</p></div>}
    {bill ? <div className="mt-3 rounded-xl border border-slate-200 p-3"><h5 className="font-bold">AI summary of your bill</h5><p className="mt-2 whitespace-pre-wrap break-words">{bill}</p></div> : !savedCost && <p className="mt-3 text-sm text-slate-700">No complete current-cost information was provided. Check the amount, currency and billing period before comparing.</p>}
    {recommendation ? <div className="mt-3 rounded-xl bg-violet-50 p-3">
      <h5 className="font-bold text-violet-950">Recommended next action</h5>
      <p className="mt-2 whitespace-pre-wrap break-words">{recommendation}</p>
    </div> : <p className="mt-3 text-amber-900">No separate recommendation was found. Review the full response below.</p>}
    {actionList && <div className="mt-3 rounded-xl border border-slate-200 p-3"><h5 className="font-bold">Your action list</h5><p className="mt-2 whitespace-pre-wrap break-words">{actionList}</p></div>}
    <div className="mt-3 rounded-xl border border-slate-200 p-3" aria-label="Savings evidence status"><h5 className="font-bold">Potential savings</h5>{estimatedSavings && <div className="mt-2 rounded-lg bg-amber-50 p-3"><p className="font-semibold text-amber-950">AI estimate, not a verified saving</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{estimatedSavings}</p></div>}{reviewedDifferences.length > 0 && <ul className="mt-2 space-y-1">{reviewedDifferences.map((difference, index) => <li key={index} className="font-semibold">{difference.direction === "saving" ? "Indicative saving: " : "Indicative extra cost: "}{difference.value} over {difference.months} months</li>)}</ul>}<p className="mt-2 text-sm text-slate-700">{customerChecked ? "Your plan contains a comparison using a source you checked. HomeAdmin has not independently verified the offer, price or availability." : "Any savings figures above are AI estimates unless supported by a provider offer you have checked. HomeAdmin has not independently verified prices or availability."} Compare equivalent services, contract length, introductory and later prices, fees, eligibility and exit costs before treating an offer as cheaper.</p></div>
    {alternatives ? <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <h5 className="font-bold">Alternatives from the AI response</h5>
      <p className="mt-2 whitespace-pre-wrap break-words">{alternatives}</p>
    </div> : <p className="mt-3 text-sm text-slate-700">No separate alternatives section was found.</p>}
    <p className="mt-3 text-sm font-semibold text-amber-950">{hasSourceEvidence ? "The AI response includes a web link and date. This is a reference supplied by the AI, not independent verification by HomeAdmin." : "The AI response does not include both a web link and a check date in the alternatives section."} Open the provider source and confirm the offer, eligibility, total cost and terms before acting. Savings are not guaranteed.</p>
  </section>;
}
