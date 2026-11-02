import { useState } from "react";

type Offer = { provider: string; monthly: string; fee: string; url: string; checked: boolean };
const field = "mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";
const button = "min-h-[44px] rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";

function money(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
function officialLink(value: string): string | null {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export default function ComparisonWorksheet({ provider, onApply }: { provider: string; onApply: (summary: string) => void }) {
  const [current, setCurrent] = useState("");
  const [offer, setOffer] = useState<Offer>({ provider: "", monthly: "", fee: "0", url: "", checked: false });
  const [checkedDate, setCheckedDate] = useState("");
  const [terms, setTerms] = useState("");
  const [action, setAction] = useState("Request a like-for-like renewal quote before changing provider.");
  const [message, setMessage] = useState("");
  const before = money(current), after = money(offer.monthly), fee = money(offer.fee);
  const annual = before !== null && after !== null && fee !== null ? Math.round(((before - after) * 12 - fee) * 100) / 100 : null;
  const source = officialLink(offer.url);
  const evidenceReady = Boolean(source && offer.checked && checkedDate && terms.trim() && offer.provider.trim());
  const letter = message || `Hello ${provider || "Customer services"},\n\nI am reviewing my current service and would appreciate your best like-for-like renewal price. I have seen an alternative from ${offer.provider || "[provider]"} at ${after === null ? "[monthly amount]" : "£" + after.toFixed(2) + " per month"}. Please confirm your best monthly price, full contract cost, any setup or exit fees, and which services are included.\n\nI have not accepted a new contract. Please reply in writing.\n\nKind regards`;
  return <section aria-label="Savings comparison worksheet" className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
    <h4 className="text-lg font-bold text-violet-950">Compare an offer and prepare your next action</h4>
    <p className="mt-2 text-slate-700">Enter only figures you have checked. HomeAdmin does not search or independently verify live prices here. The calculation compares 12 monthly payments plus one-off switching fees, not changing tariffs or other charges.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="font-semibold">Current monthly cost (£)<input className={field} inputMode="decimal" value={current} onChange={e => setCurrent(e.target.value)} placeholder="e.g. 95.00" /></label>
      <label className="font-semibold">Alternative provider<input className={field} value={offer.provider} onChange={e => setOffer(v => ({ ...v, provider: e.target.value, checked: false }))} placeholder="Provider name" /></label>
      <label className="font-semibold">Alternative monthly cost (£)<input className={field} inputMode="decimal" value={offer.monthly} onChange={e => setOffer(v => ({ ...v, monthly: e.target.value, checked: false }))} placeholder="e.g. 65.00" /></label>
      <label className="font-semibold">One-off fees (£)<input className={field} inputMode="decimal" value={offer.fee} onChange={e => setOffer(v => ({ ...v, fee: e.target.value, checked: false }))} /></label>
    </div>
    <label className="mt-3 block font-semibold">Official offer link (HTTPS)<input className={field} type="url" value={offer.url} onChange={e => setOffer(v => ({ ...v, url: e.target.value, checked: false }))} placeholder="https://provider.example/offer" /></label>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="font-semibold">Date you checked the offer<input type="date" className={field} value={checkedDate} onChange={e => { setCheckedDate(e.target.value); setOffer(v => ({ ...v, checked: false })); }} /></label><label className="font-semibold">Contract length and terms checked<input className={field} value={terms} onChange={e => { setTerms(e.target.value); setOffer(v => ({ ...v, checked: false })); }} placeholder="e.g. 18 months; fixed price; exit fee" /></label></div>
    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-violet-800 underline">Open the offer source to check the terms</a>}
    <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={offer.checked} onChange={e => setOffer(v => ({ ...v, checked: e.target.checked }))} /><span>I checked the provider's current offer, contract length, service equivalence and fees on this link. This is my review, not independent verification by HomeAdmin.</span></label>
    <div role="status" className="mt-4 rounded-xl bg-white p-4">
      <p className="font-semibold">12-month comparison</p>
      {annual === null ? <p>Enter valid monthly figures and one-off fees to see the difference.</p> : <><p>Current: £{(before! * 12).toFixed(2)} · Alternative including fees: £{(after! * 12 + fee!).toFixed(2)}</p><p className="mt-1 font-bold">{annual >= 0 ? "Indicative difference: £" + annual.toFixed(2) + " less over 12 months" : "Alternative costs £" + Math.abs(annual).toFixed(2) + " more over 12 months"}</p></>}
      <p className="mt-2 text-sm text-slate-600">{evidenceReady ? "Source reviewed by you. Check any mid-contract increases and missing fees." : "Source not yet customer-checked. Do not treat this offer as verified."}</p>
    </div>
    <label className="mt-3 block font-semibold">Recommended next action<textarea className={field} rows={2} value={action} onChange={e => setAction(e.target.value)} /></label>
    <label className="mt-3 block font-semibold">Editable negotiation letter<textarea className={field} rows={8} value={letter} onChange={e => setMessage(e.target.value)} /></label>
    <button className={button + " mt-4"} type="button" disabled={annual === null || !evidenceReady || !action.trim() || !letter.trim()} onClick={() => onApply(`Savings comparison (customer-checked source, not independently verified by HomeAdmin)\nCurrent monthly cost: £${before!.toFixed(2)}\nAlternative provider: ${offer.provider.trim()}\nAlternative monthly cost: £${after!.toFixed(2)}\nOne-off fees: £${fee!.toFixed(2)}\n12-month difference: £${annual!.toFixed(2)} (${annual! >= 0 ? "saving" : "additional cost"})\nCustomer-reviewed source URL: ${source}\nChecked on: ${checkedDate}\nContract terms: ${terms.trim()}\nNext action: ${action.trim()}\n\nEditable provider message:\n${letter}`)}>Add checked comparison and letter to plan</button>
    <p className="mt-2 text-sm text-slate-600">The comparison is added to your editable plan. Review the combined text and tick the final fact-check before saving. Nothing is sent automatically.</p>
  </section>;
}
