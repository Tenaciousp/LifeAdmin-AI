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

export default function PlanResultSummary({ plan }: { plan: string }) {
  const recommendation = section(plan, /^(?:Best next action|My first next step|Recommended action)$/i);
  const alternatives = section(plan, /^(?:Alternatives to consider|Comparison of alternatives|Provider comparison)$/i);
  if (!recommendation && !alternatives) {
    return <section aria-label="AI result overview" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="font-bold text-amber-950">Recommendation needs review</h4>
      <p className="mt-2 text-sm text-amber-950">The AI answer has no clearly labelled recommendation or comparison. Read the full plan below and request a clearer answer before relying on savings claims.</p>
    </section>;
  }
  return <section aria-label="AI result overview" className="rounded-xl border border-violet-200 bg-white p-4">
    <h4 className="text-lg font-bold text-violet-950">Your AI results at a glance</h4>
    {recommendation ? <div className="mt-3 rounded-xl bg-violet-50 p-3">
      <h5 className="font-bold text-violet-950">Recommended next action</h5>
      <p className="mt-2 whitespace-pre-wrap break-words">{recommendation}</p>
    </div> : <p className="mt-3 text-amber-900">No separate recommendation was found. Review the full response below.</p>}
    {alternatives ? <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <h5 className="font-bold">Alternatives from the AI response</h5>
      <p className="mt-2 whitespace-pre-wrap break-words">{alternatives}</p>
    </div> : <p className="mt-3 text-sm text-slate-700">No separate alternatives section was found.</p>}
    <p className="mt-3 text-sm font-semibold text-amber-950">AI suggestions are not independently verified offers. Check provider websites, eligibility, all fees and contract terms before acting. Do not treat quoted savings as guaranteed.</p>
  </section>;
}
