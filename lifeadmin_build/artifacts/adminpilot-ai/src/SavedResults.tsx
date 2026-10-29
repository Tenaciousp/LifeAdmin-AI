import { EmptyState } from "./Feedback";

type RecordData = { id: string; title: string; [key: string]: any };
const control = "box-border min-w-0 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
const action = "min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700";

export default function SavedResults({ plans, tasks, query, billId, kind, onQuery, onBill, onKind, onOpen, onDelete }: {
  plans: RecordData[]; tasks: RecordData[]; query: string; billId: string; kind: string;
  onQuery: (value: string) => void; onBill: (value: string) => void; onKind: (value: string) => void;
  onOpen: (plan: RecordData) => void; onDelete: (plan: RecordData) => void;
}) {
  const billMap = new Map(tasks.map(task => [task.id, task]));
  const resultType = (plan: RecordData) => ["plan", "letter", "reply"].includes(plan.workflow_output) ? plan.workflow_output : "plan";
  const timestamp = (plan: RecordData) => Number.isFinite(Date.parse(plan.created_at)) ? Date.parse(plan.created_at) : 0;
  const visible = plans.filter(plan => {
    const bill = billMap.get(plan.task_id);
    return (!billId || plan.task_id === billId) && (!kind || resultType(plan) === kind) &&
      [plan.title, plan.provider_email?.subject, bill?.title, bill?.details?.provider].join(" ").toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => timestamp(b) - timestamp(a) || a.title.localeCompare(b.title));
  const reset = () => { onQuery(""); onBill(""); onKind(""); };
  return <section id="saved-plans" aria-labelledby="saved-results-heading" className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm">
    <h2 id="saved-results-heading" tabIndex={-1} className="text-xl font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700">{`Saved plans (${plans.length})`}</h2>
    <p className="mt-2 text-slate-600">Your plans, letters and replies, newest first. Each result stays linked to its bill. Saving or copying a message does not send it.</p>
    {plans.length > 0 ? <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>Search saved results<input className={control + " mt-1"} value={query} onChange={event => onQuery(event.target.value)} placeholder="Title, message subject, bill or provider" /></label>
        <label>Results for bill<select className={control + " mt-1"} value={billId} onChange={event => onBill(event.target.value)}><option value="">All bills</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <label>Result type<select className={control + " mt-1"} value={kind} onChange={event => onKind(event.target.value)}><option value="">All result types</option><option value="plan">Plans</option><option value="letter">Letters</option><option value="reply">Replies</option></select></label>
      </div>
      <p role="status" className="mt-3 text-slate-600">{`Showing ${visible.length} of ${plans.length} saved results.`}</p>
      {(query || billId || kind) && <button className={action + " mt-2"} onClick={reset}>Clear result filters</button>}
      {!visible.length && <p className="mt-4 rounded-xl bg-slate-50 p-4">No results match these filters. Clear the filters or try another bill, result type or search.</p>}
      <ul className="mt-4 space-y-3">{visible.map(plan => {
        const bill = billMap.get(plan.task_id);
        const type = resultType(plan);
        const label = type === "reply" ? "Reply" : type === "letter" ? "Letter" : "Plan";
        const date = timestamp(plan);
        return <li key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="inline-block rounded-lg bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-950">{label}</span><span className="inline-block rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">{plan.source === "local" ? "Offline template" : plan.source === "external_ai_api" ? "AI-generated, review facts" : plan.source === "external_ai_manual" ? "AI answer reviewed by you" : "Source not recorded"}</span></div>
          <h3 className="mt-3 text-lg font-bold text-slate-950">{plan.title}</h3>
          <p className="mt-1 text-slate-600">Bill: {bill?.title || "Original bill unavailable"}{bill?.details?.provider ? ` · ${bill.details.provider}` : ""}</p>
          {date > 0 && <p className="mt-1 text-slate-600">Saved <time dateTime={plan.created_at}>{new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time></p>}
          <div className="mt-3 flex flex-wrap gap-2"><button className={action} onClick={() => onOpen(plan)}>Open {label.toLowerCase()}</button><button className={action} onClick={() => onDelete(plan)}>Delete {label.toLowerCase()}</button></div>
        </li>;
      })}</ul>
    </> : <EmptyState title="No saved plans" description="Save a bill, then choose Create a plan or message. Your reviewed plans, letters and replies will appear here." />}
  </section>;
}
