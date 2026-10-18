import { useEffect, useRef, useState } from "react";
import { catalog, suggest } from "./lib/offline/domain.mjs";
import { exportDeviceBackup, chooseDeviceBackup, isNativeDevice, copyDeviceText } from "./lib/offline/device-files.mjs";
import { openDeviceStore } from "./lib/offline/device-store.mjs";
import { generateAndSaveLocalPlan, missingDetails, planTextForCopy, manualAiPrompt } from "./lib/offline/plans.mjs";
import type { MessageDraft } from "./lib/offline/storage.mjs";

type RecordData = { id: string; title: string; [key: string]: any };
type Snapshot = { tasks: RecordData[]; plans: RecordData[] };
const catalogue = catalog();
const modes = [["full", "Full plan"], ["more_options", "Compare approaches"], ["renewal_pro", "Renewal plan"], ["refund_pro", "Refund or complaint"], ["document_pro", "Document review"], ["travel_pro", "Travel admin"], ["family_board", "Family board"], ["small_landlord", "Property admin"]];
const button = "max-w-full min-h-[44px] rounded-xl bg-violet-700 px-[16px] py-2 font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:opacity-50";
const input = "box-border min-w-0 max-w-full min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-[12px] py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";

export default function LocalApp() {
  const store = useRef<any>(null);
  const running = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ tasks: [], plans: [] });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [match, setMatch] = useState<any>(null);
  const [category, setCategory] = useState("");
  const [goal, setGoal] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [draftEdit, setDraftEdit] = useState<{ subject: string; body: string; expected: MessageDraft } | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [mode, setMode] = useState("full");
  const [backups, setBackups] = useState(false);
  useEffect(() => { if (selected) document.getElementById("local-plan-heading")?.focus(); }, [selected?.id]);
  useEffect(() => { setDraftEdit(null); }, [selected?.id]);
  useEffect(() => { setAiPrompt(null); }, [selected?.id]);
  const handoffOpen = aiPrompt !== null;
  useEffect(() => { if (handoffOpen) document.getElementById("local-ai-heading")?.focus(); }, [handoffOpen]);

  useEffect(() => {
    let active = true;
    let connection: any;
    setReady(false);
    setError("");
    (async () => {
      try {
        connection = await openDeviceStore();
        const data = await connection.read();
        if (!active) { connection.close(); return; }
        store.current = connection;
        setSnapshot(data);
        setReady(true);
      } catch (failure) {
        connection?.close();
        if (active) setError(failure instanceof Error ? failure.message : "Device storage is unavailable.");
      }
    })();
    return () => { active = false; connection?.close(); store.current = null; };
  }, [retry]);

  async function run(action: () => Promise<void>) {
    if (running.current || !ready) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); setSnapshot(await store.current.read()); }
    catch (failure) {
      if ((failure as { code?: string })?.code === "cancelled") setMessage("Backup action cancelled. Existing records are unchanged.");
      else setError(failure instanceof Error ? failure.message : "Unable to save changes. Please retry.");
    }
    finally { running.current = false; setBusy(false); }
  }

  const categoryObj = catalogue.categories.find((item: any) => item.id === category);
  const goalObj = catalogue.goals.find((item: any) => item.id === goal);
  const fields: any[] = [...new Map<string, any>([...(categoryObj?.fields || []), ...(goalObj?.fields || [])].map((field: any) => [field.id, field] as [string, any])).values()];
  function resetForm() { setEditing(null); setCategory(""); setGoal(""); setDetails({}); setTitle(""); setNotes(""); }
  function edit(task: RecordData) {
    setEditing(task.id); setCategory(task.category_id); setGoal(task.goal_id);
    setDetails({ ...task.details }); setTitle(task.title); setNotes(task.notes || "");
    document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth" });
  }
  async function save() {
    if (!category || !goal) { setError("Choose a bill type and goal."); return; }
    const task = { title: title.trim() || goalObj.label + ": " + categoryObj.label, category_id: category, category: categoryObj.label, goal_id: goal, details, notes, status: editing ? snapshot.tasks.find(item => item.id === editing)?.status || "Open" : "Open", updated_at: new Date().toISOString() };
    await run(async () => {
      if (editing) await store.current.updateTask(editing, task);
      else await store.current.createTask({ ...task, id: crypto.randomUUID(), created_at: new Date().toISOString() });
      resetForm(); setMessage("Bill saved on this device.");
    });
  }
  async function generate(task: RecordData) {
    if (draftEdit && !window.confirm("Discard unsaved message edits and create a plan?")) return;
    const gaps = missingDetails(task);
    if (gaps.length && !window.confirm("Useful details are missing:\n\n" + gaps.join("\n") + "\n\nGenerate a plan using the supplied details?")) return;
    await run(async () => { const plan = await generateAndSaveLocalPlan(store.current, task.id, mode); setSelected(plan); setMessage("Plan saved on this device."); });
  }
  function openPlan(plan: RecordData) {
    if (draftEdit && !window.confirm("Discard unsaved message edits and open this plan?")) return;
    setDraftEdit(null); setAiPrompt(null); setSelected(plan);
  }
  async function saveMessage() {
    if (!selected || !draftEdit) return;
    await run(async () => {
      const updated = await store.current.updatePlanMessage(selected.id, {
        subject: draftEdit.subject, body: draftEdit.body,
      }, draftEdit.expected);
      setSelected(updated); setDraftEdit(null); setAiPrompt(null); setMessage("Message saved on this device. Nothing was sent.");
    });
  }
  async function exportBackup() {
    if (!window.confirm("The backup contains personal bill and plan details as a readable file. Choose a private destination and keep the file secure. Export now?")) return;
    await run(async () => {
      const data = await store.current.exportBackup();
      const outcome = await exportDeviceBackup(data);
      setMessage(outcome === "saved" ? "Backup export completed. Check the chosen file before relying on this copy." : "Backup download requested. Check the chosen destination before relying on this copy.");
    });
  }
  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Backup exceeds the 5 MB limit."); return; }
    if (!window.confirm("Restore replaces every bill and plan on this device. Export your current records first if needed. Replace the current records?")) return;
    await run(async () => {
      await store.current.importBackup(await file.text(), { replace: true });
      resetForm(); setSelected(null); setMessage("Backup restored on this device.");
    });
  }

  async function chooseRestore() {
    if (!isNativeDevice()) { fileInput.current?.click(); return; }
    await run(async () => {
      const text = await chooseDeviceBackup();
      if (!text || !window.confirm("Restore replaces every bill and plan on this device. Export your current records first if needed. Replace the current records?")) return;
      await store.current.importBackup(text, { replace: true });
      resetForm(); setSelected(null); setMessage("Backup restored on this device.");
    });
  }

  return <div style={{ overflowWrap: "anywhere", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }} className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-teal-50 text-slate-900">
    <header className="border-b border-violet-100 bg-white px-[20px] py-5"><div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3"><div><p className="font-extrabold text-2xl text-violet-800">LifeAdmin</p><p className="text-base text-slate-600">List, plan and save.</p></div><a className="min-h-[44px] inline-flex items-center underline font-semibold text-violet-800" href="https://tenaciouspl.co.uk" target="_blank" rel="noopener noreferrer">Examples & support</a></div></header>
    <main className="mx-auto max-w-6xl px-[20px] py-8 space-y-6">
      <section><h1 className="text-3xl font-extrabold">Manage your household bills in one place</h1><p className="mt-3 text-slate-600">Your bills and plans stay on this device. No LifeAdmin sign-in. Review every draft before acting.</p></section>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}{!ready && <button className={button + " ml-3"} onClick={() => setRetry(value => value + 1)}>Retry storage</button>}</div>}
      {message && <p role="status" className="rounded-xl bg-teal-100 p-4 text-teal-950">{message}</p>}
      {!ready && !error && <p role="status">Opening your device records…</p>}
      {ready && <>
      <fieldset disabled={busy} className="min-w-0 space-y-6 border-0 p-0" aria-busy={busy}>
        <section className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm">
          <h2 className="text-xl font-bold">Find a bill or provider</h2>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setMatch(suggest(search)); }}><label className="sr-only" htmlFor="bill-search">Bill or provider</label><input id="bill-search" className={input} value={search} maxLength={500} placeholder="e.g. Cancel Netflix or review energy" onChange={event => setSearch(event.target.value)} /><button className={button}>Search</button></form>
          {match && <div className="mt-4"><p>{match.category_id ? catalogue.categories.find((item: any) => item.id === match.category_id)?.label : "Choose the closest bill type below."}</p>{match.category_id && <button className={button + " mt-2"} onClick={() => { resetForm(); setCategory(match.category_id); setGoal(match.goal_id || ""); setDetails({ ...(match.prefill_details || {}) }); setMatch(null); }}>Use suggestion</button>}</div>}
        </section>
        <section id="bill-form" className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm">
          <h2 className="text-xl font-bold">{editing ? "Edit bill" : "Add a bill"}</h2>
          <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
            <div className="grid gap-4 sm:grid-cols-2"><label>Bill type<select required className={input + " mt-1"} value={category} onChange={event => { setCategory(event.target.value); setDetails({}); }}><option value="">Choose a bill type</option>{catalogue.categories.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Your goal<select required className={input + " mt-1"} value={goal} onChange={event => setGoal(event.target.value)}><option value="">Choose a goal</option>{catalogue.goals.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
            <label className="block">Bill name<input className={input + " mt-1"} value={title} maxLength={160} placeholder="Optional name" onChange={event => setTitle(event.target.value)} /></label>
            <p className="text-base text-slate-600">Add the details you know. Leave the rest blank. Avoid passwords, full card numbers and security codes.</p>
            <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.id} className="block min-w-0">{field.label}{field.recommended && <span className="text-base text-slate-500"> (useful)</span>}{field.type === "select" ? <select className={input + " mt-1"} value={details[field.id] || ""} onChange={event => setDetails(value => ({ ...value, [field.id]: event.target.value }))}><option value="">Choose if known</option>{field.options?.map((option: string) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea className={input + " mt-1"} maxLength={500} rows={3} value={details[field.id] || ""} placeholder={field.placeholder} onChange={event => setDetails(value => ({ ...value, [field.id]: event.target.value }))} /> : <input className={input + " mt-1"} type={field.type === "date" ? "date" : "text"} maxLength={500} value={details[field.id] || ""} placeholder={field.placeholder} onChange={event => setDetails(value => ({ ...value, [field.id]: event.target.value }))} />}</label>)}</div>
            <label className="block">Additional notes<textarea className={input + " mt-1"} rows={3} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
            <div className="flex gap-3"><button className={button}>{busy ? "Saving…" : "Save bill"}</button>{editing && <button type="button" className={button} onClick={resetForm}>Cancel edit</button>}</div>
          </form>
        </section>
        <section className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm"><h2 className="text-xl font-bold">{`Your bills (${snapshot.tasks.length})`}</h2><label className="mt-4 block max-w-sm">Planning style<select className={input + " mt-1"} value={mode} onChange={event => setMode(event.target.value)}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{!snapshot.tasks.length && <p className="mt-4 text-slate-600">Add your first bill above.</p>}<ul className="mt-4 space-y-3">{snapshot.tasks.map(task => <li key={task.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">{task.title}</h3><p className="text-base text-slate-600">{`${task.category} · ${task.status}`}</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => void generate(task)}>Create plan</button><button className={button} onClick={() => edit(task)}>Edit</button><button className={button} onClick={() => void run(async () => { await store.current.updateTask(task.id, { status: task.status === "Done" ? "Open" : "Done" }); setMessage("Bill status saved."); })}>{task.status === "Done" ? "Reopen" : "Mark done"}</button><button className={button} onClick={() => { if (window.confirm("Delete this bill and every associated plan?")) void run(async () => { await store.current.deleteTask(task.id); if (selected?.task_id === task.id) setSelected(null); if (editing === task.id) resetForm(); setMessage("Bill and associated plans deleted."); }); }}>Delete bill</button></div></li>)}</ul></section>
        <section className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm"><h2 className="text-xl font-bold">{`Saved plans (${snapshot.plans.length})`}</h2>{!snapshot.plans.length && <p className="mt-4 text-slate-600">Create a plan from a saved bill.</p>}<ul className="mt-4 space-y-3">{snapshot.plans.map(plan => <li key={plan.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3"><span className="w-full min-w-0 font-semibold">{plan.title}</span><button className={button} onClick={() => openPlan(plan)}>Open plan</button><button className={button} onClick={() => { if (window.confirm("Delete this saved plan?")) void run(async () => { await store.current.deletePlan(plan.id); if (selected?.id === plan.id) setSelected(null); setMessage("Plan deleted."); }); }}>Delete plan</button></li>)}</ul></section>
        {selected && <section className="rounded-2xl border border-teal-200 bg-white p-[20px] shadow-sm"><h2 id="local-plan-heading" tabIndex={-1} className="text-xl font-bold focus-visible:outline focus-visible:outline-violet-700">{selected.title}</h2>{selected.missing_details?.length > 0 && <p className="mt-3 text-amber-900">Useful missing details: {selected.missing_details.join(", ")}</p>}<p className="mt-3 text-base text-slate-600">General guidance only. Confirm current provider terms and official information before acting. Nothing is sent automatically.</p>{Object.entries(selected.sections || {}).filter(([key, value]) => String(value).trim() && !(key === "provider_message" && selected.provider_email)).map(([key, value]) => <section key={key} className="mt-5"><h3 className="font-bold capitalize">{key.replaceAll("_", " ")}</h3><PlanText text={String(value)} /></section>)}{!Object.values(selected.sections || {}).some(value => String(value).trim()) && selected.content && <PlanText text={String(selected.content)} />}{selected.provider_email && <section className="mt-5"><h3 className="font-bold">{selected.provider_email.kind === "bank_query" ? "Bank-query draft" : "Provider-message draft"}</h3>{draftEdit ? <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void saveMessage(); }}><p className="text-base text-slate-600">Edits stay here until saved. Nothing is sent automatically.</p><label className="block">Message subject<input className={input + " mt-1"} required maxLength={200} value={draftEdit.subject} onChange={event => setDraftEdit(value => value && ({ ...value, subject: event.target.value }))} /></label><label className="block">Message body<textarea className={input + " mt-1"} required rows={10} maxLength={20000} value={draftEdit.body} onChange={event => setDraftEdit(value => value && ({ ...value, body: event.target.value }))} /></label><div className="flex flex-wrap gap-3"><button className={button}>Save message</button><button type="button" className={button} onClick={() => setDraftEdit(null)}>Cancel message edit</button></div></form> : <><p className="mt-2 font-semibold">{selected.provider_email.subject}</p><p className="mt-2 whitespace-pre-wrap">{selected.provider_email.body}</p><button className={button + " mt-3"} onClick={() => { setAiPrompt(null); setDraftEdit({ subject: selected.provider_email.subject, body: selected.provider_email.body, expected: { ...selected.provider_email } }); }}>Edit message</button></>}</section>}<button disabled={draftEdit !== null} className={button + " mt-4 mr-3"} onClick={() => void run(async () => { await copyDeviceText(planTextForCopy(selected)); setMessage("Plan copied. Review before sharing."); })}>Copy plan</button>{selected.provider_email && <button disabled={draftEdit !== null} className={button + " mt-4 mr-3"} onClick={() => void run(async () => { await copyDeviceText("Subject: " + selected.provider_email.subject + "\n\n" + selected.provider_email.body); setMessage("Message copied. Review before sending."); })}>Copy message</button>}<button disabled={draftEdit !== null} className={button + " mt-4 mr-3"} onClick={() => void run(async () => { setAiPrompt(manualAiPrompt(selected)); })}>Prepare AI prompt</button>{aiPrompt !== null && <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4" aria-labelledby="local-ai-heading"><h3 id="local-ai-heading" tabIndex={-1} className="font-bold focus-visible:outline focus-visible:outline-violet-700">Review your AI prompt</h3><p className="mt-3">Review and remove private details before copying. Copying places this text on your device clipboard. Pasting into another service shares the text with that service.</p><p className="mt-3">Prompt edits are temporary. Save changes to your message above before preparing a new prompt.</p><label className="mt-3 block">AI prompt<textarea className={input + " mt-1"} rows={12} maxLength={200000} value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-3"><button disabled={!aiPrompt.trim()} className={button} onClick={() => void run(async () => { await copyDeviceText(aiPrompt); setMessage("AI prompt copied. Paste into your chosen service after reviewing the details."); })}>Copy AI prompt</button><button className={button} onClick={() => { setAiPrompt(null); document.getElementById("local-plan-heading")?.focus(); }}>Close AI prompt</button></div><p className="mt-4">Open your preferred service and paste the prompt yourself. Review the reply before updating bill details or editing your message here.</p><div className="mt-3 flex flex-wrap gap-3">{[["ChatGPT", "https://chatgpt.com/"], ["Gemini", "https://gemini.google.com/"], ["Copilot", "https://copilot.microsoft.com/"], ["Claude", "https://claude.ai/new"], ["Perplexity", "https://www.perplexity.ai/"]].map(([name, url]) => <a key={name} className={button + " inline-flex items-center"} href={url} target="_blank" rel="noopener noreferrer">Open {name}</a>)}</div></section>}</section>}
        <section className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm"><h2 className="text-xl font-bold">Your data and backups</h2><p className="mt-3 text-slate-600">TenaciousPL holds no recovery copy of your household records. Device cloud backups depend on your settings and the final app package. Export a private copy before deleting the app or changing devices.</p><button className={button + " mt-4"} onClick={() => setBackups(value => !value)}>{backups ? "Hide backup controls" : "Manage backups"}</button>{backups && <div className="mt-4 space-y-3"><p>Backup files contain readable personal information. Keep your chosen copy private. Restore replaces existing bills and plans.</p><div className="flex flex-wrap gap-3"><button className={button} onClick={() => void exportBackup()}>Export backup</button><button className={button} onClick={() => void chooseRestore()}>Restore backup</button><input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importBackup(file); }} /><button className={button} onClick={() => { if (window.confirm("Delete every bill and plan on this device? Export a backup first if needed.")) void run(async () => { await store.current.clear(); resetForm(); setSelected(null); setMessage("All device records deleted."); }); }}>Delete all records</button></div></div>}</section>
      </fieldset>
      </>}
    </main><footer className="mx-auto max-w-6xl px-[20px] py-8 text-base text-slate-600"><p>TenaciousPL support</p><div className="mt-3 flex flex-wrap gap-3"><a className={button + " inline-flex items-center"} href="mailto:tenaciouspl@icloud.com" aria-label="Email TenaciousPL support">Email support</a><a className={button + " inline-flex items-center"} href="https://tenaciouspl.co.uk/app-privacy.html" target="_blank" rel="noopener noreferrer">App privacy policy</a></div></footer>
  </div>;
}

function PlanText({ text }: { text: string }) {
  return <div className="mt-2 leading-relaxed">{text.replace(/^##\s+(Next steps|Provider message|Things to check|Approval checklist)\s*\n/i, "").split(/\r?\n/).map((line, index) => {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) return <h4 key={index} className="mt-4 mb-2 font-semibold">{heading[1]}</h4>;
    return line.trim() ? <p key={index} className="my-2 whitespace-pre-wrap">{line}</p> : null;
  })}</div>;
}



