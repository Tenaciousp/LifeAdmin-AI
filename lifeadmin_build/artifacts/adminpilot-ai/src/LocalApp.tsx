import { useEffect, useRef, useState } from "react";
import { billCategory, fieldsFor, goalsFor } from "./lib/offline/bill-types.mjs";
import { billGroups, billTypeForSuggestion, groupForCategory, resolveBillType } from "./lib/offline/bill-picker.mjs";
import { catalog, suggest } from "./lib/offline/domain.mjs";
import { exportDeviceBackup, chooseDeviceBackup, isNativeDevice, copyDeviceText } from "./lib/offline/device-files.mjs";
import { openDeviceStore } from "./lib/offline/device-store.mjs";
import { generateAndSaveLocalPlan, missingDetails, planTextForCopy } from "./lib/offline/plans.mjs";
import AiHandoff from "./AiHandoff";
import { EmptyState, LoadingSpinner } from "./Feedback";
import BillOverview from "./BillOverview";
import BillHelp from "./BillHelp";
import SavedResults from "./SavedResults";
import { initialWorkflow, workflowResult } from "./lib/offline/bill-workflow.mjs";
import type { WorkflowDraft } from "./lib/offline/bill-workflow.mjs";
import { recurringCost, money, sortBills } from "./lib/offline/bill-overview.mjs";
import DiaryPanel from "./DiaryPanel";
import { diaryDates, validDiaryDate } from "./lib/offline/diary.mjs";
import type { MessageDraft } from "./lib/offline/storage.mjs";

type RecordData = { id: string; title: string; [key: string]: any };
type Snapshot = { tasks: RecordData[]; plans: RecordData[] };
const catalogue = catalog();
const button = "max-w-full min-h-[44px] rounded-xl bg-violet-700 px-[16px] py-2 font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:opacity-50";
// Date controls also disable native appearance: iOS otherwise forces content-box sizing.
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
  const [messageEditError, setMessageEditError] = useState<{ subject?: string; body?: string }>({});
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [mode, setMode] = useState("full");
  const [backups, setBackups] = useState(false);
  const [billFilter, setBillFilter] = useState("active");
  const [billSearch, setBillSearch] = useState("");
  const [billSort, setBillSort] = useState("next_date");
  const [resultQuery, setResultQuery] = useState("");
  const [resultBill, setResultBill] = useState("");
  const [resultKind, setResultKind] = useState("");
  const [helpId, setHelpId] = useState<string | null>(null);
  const [helpSession, setHelpSession] = useState(0);
  const helpDirty = useRef(false);
  const helpTask = snapshot.tasks.find(task => task.id === helpId);
  const resultTask = snapshot.tasks.find(task => task.id === selected?.task_id);
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
  const availableGoals = goalsFor(category);
  const goalObj = availableGoals.find((item: any) => item.id === goal);
  const fields: any[] = fieldsFor(category, goal, details);
  const selectedBillGroup = billGroups.find((item: any) => item.id === details.bill_group_id) || groupForCategory(category);
  const selectedBillType = selectedBillGroup?.types.find((item: any) => item.id === details.bill_type_id) || resolveBillType({ category_id: category, details })?.type;

  function chooseBillGroup(groupId: string) {
    const group = billGroups.find((item: any) => item.id === groupId);
    setFieldErrors({}); setError(""); setCategory(""); setGoal(""); setDetails(group ? { bill_group_id: group.id } : {});
  }
  function chooseBillType(typeId: string) {
    const group = selectedBillGroup;
    setFieldErrors(previous => ({ ...previous, bill_type_id: "", goal_id: "" })); setError("");
    const type = group?.types.find((item: any) => item.id === typeId);
    if (!type || !group) { setCategory(""); setGoal(""); return; }
    const next: Record<string, string> = { bill_group_id: group.id, bill_type_id: type.id, bill_type: type.label, [type.detail_key]: type.detail_value };
    if (type.id === "water_sewerage") next.water_services = "Water and sewerage";
    setCategory(type.category_id); setGoal(""); setDetails(next);
  }
  function quickAddBill(typeId: string) {
    const group = billGroups.find((item: any) => item.types.some((type: any) => type.id === typeId));
    const type = group?.types.find((item: any) => item.id === typeId);
    if (!group || !type) return;
    resetForm(); setDetails({ bill_group_id: group.id, bill_type_id: type.id, bill_type: type.label, [type.detail_key]: type.detail_value });
    setCategory(type.category_id); document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth" });
  }

  function changeDetail(id: string, value: string) {
    setFieldErrors(previous => ({ ...previous, [id]: "" })); setError("");
    setDetails(previous => {
      const next = { ...previous, [id]: value };
      if (id === "billing_basis" && ["Unmetered / rateable value", "Assessed charge", "Included in council tax / rates", "Flat / assessed charge", "Included in rent / local taxes"].includes(value)) {
        for (const key of ["meter_reading", "reading_basis", "water_usage"]) delete next[key];
      }
      return next;
    });
  }
  const primaryIds = new Set(["provider", "amount", "currency", "country", "billing_frequency", "next_payment_date", "service_type", "policy_type", "finance_type", "water_region", "billing_basis", "what_happened", "utility_type", "tariff"]);
  if (goal === "water_meter") primaryIds.add("household_size");
  for (const id of ["country_name", "local_area"]) primaryIds.add(id);
  if (goal === "water_usage") for (const id of ["reading_basis", "meter_reading", "water_usage", "bill_period"]) primaryIds.add(id);
  const primaryFields = fields.filter(field => field.recommended || primaryIds.has(field.id));
  const additionalFields = fields.filter(field => !primaryFields.includes(field));
  const renderField = (field: any) => <label key={field.id} className="block min-w-0">{field.label}{field.recommended && <span className="text-base text-slate-500"> (useful)</span>}
    {field.type === "select" ? <select id={field.id} aria-invalid={!!fieldErrors[field.id]} aria-describedby={fieldErrors[field.id] ? field.id + "-error" : undefined} className={input + " mt-1"} value={details[field.id] || ""} onChange={event => changeDetail(field.id, event.target.value)}><option value="">Choose if known</option>{field.options?.map((option: string) => <option key={option}>{option}</option>)}</select>
      : field.type === "textarea" ? <textarea id={field.id} aria-invalid={!!fieldErrors[field.id]} aria-describedby={fieldErrors[field.id] ? field.id + "-error" : undefined} className={input + " mt-1"} maxLength={500} rows={3} value={details[field.id] || ""} placeholder={field.placeholder} onChange={event => changeDetail(field.id, event.target.value)} />
      : <input id={field.id} aria-invalid={!!fieldErrors[field.id]} aria-describedby={fieldErrors[field.id] ? field.id + "-error" : undefined} className={input + " mt-1" + (field.type === "date" ? " appearance-none" : "")} type={field.type === "date" ? "date" : "text"} maxLength={500} value={details[field.id] || ""} placeholder={field.placeholder} onChange={event => changeDetail(field.id, event.target.value)} />}
    {fieldErrors[field.id] && <span id={field.id + "-error"} role="alert" className="mt-1 block text-sm font-semibold text-red-800">{fieldErrors[field.id]}</span>}
  </label>;

  function resetForm() { setFieldErrors({}); setError(""); setEditing(null); setCategory(""); setGoal(""); setDetails({}); setTitle(""); setNotes(""); }
  function closeHelp() {
    if (helpDirty.current && !window.confirm("Close unfinished bill help? Save progress first to keep your entered text.")) return false;
    setHelpId(null); helpDirty.current = false; return true;
  }
  function showHelp(task: RecordData) {
    if (draftEdit && !window.confirm("Discard unsaved message edits and open bill help?")) return;
    if (!closeHelp()) return;
    setDraftEdit(null);
    setHelpSession(value => value + 1); setHelpId(task.id);
  }
  async function saveHelpProgress(task: RecordData, draft: WorkflowDraft) {
    const safe = initialWorkflow({ ...task, workflow_draft: draft });
    await store.current.saveWorkflowProgress(task.id, safe, task.workflow_draft ?? null);
    setSnapshot(await store.current.read());
  }
  async function saveHelpResult(task: RecordData, draft: WorkflowDraft, service: string) {
    const note = workflowResult(task, draft, service);
    await store.current.saveWorkflowResult(note, task.workflow_draft ?? null);
    setSnapshot(await store.current.read());
    helpDirty.current = false; setHelpId(null); setSelected(note);
    setMessage("Reviewed result saved on this device. Nothing was sent. Copy the message for your provider or keep the plan for your next steps.");
  }
  function edit(task: RecordData) {
    if (!closeHelp()) return;
    const type = billCategory(task);
    setFieldErrors({}); setError(""); setEditing(task.id); setCategory(type); setGoal(goalsFor(type).some(item => item.id === task.goal_id) ? task.goal_id : "check_bill");
    const resolved = resolveBillType(task);
    setDetails({ ...task.details, ...(resolved ? { bill_group_id: resolved.group.id, bill_type_id: resolved.type.id, bill_type: resolved.type.label } : {}) }); setTitle(task.title); setNotes(task.notes || "");
    document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth" });
  }
  async function save() {
    const invalid: Record<string, string> = {};
    if (!selectedBillGroup) invalid.bill_group_id = "Choose a bill category.";
    else if (!selectedBillType) invalid.bill_type_id = "Choose a specific bill.";
    else if (!goalObj) invalid.goal_id = "Choose what you need help with.";
    for (const field of [...diaryDates, { id: "next_payment_date" }]) {
      if (details[field.id] && !validDiaryDate(details[field.id])) invalid[field.id] = "Enter a valid date.";
    }
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) {
      setError("Check the highlighted fields before saving.");
      document.getElementById(Object.keys(invalid)[0])?.focus();
      return;
    }
    if (!closeHelp()) return;
    const task = { title: title.trim() || goalObj.label + ": " + categoryObj.label, category_id: category, category: categoryObj.label, goal_id: goal, details, notes, status: editing ? snapshot.tasks.find(item => item.id === editing)?.status || "Open" : "Open", updated_at: new Date().toISOString() };
    await run(async () => {
      const id = editing || crypto.randomUUID();
      if (editing) await store.current.updateTask(editing, task);
      else await store.current.createTask({ ...task, id, created_at: new Date().toISOString() });
      resetForm(); setBillFilter("active"); setBillSearch(""); setMessage("Bill saved on this device.");
      helpDirty.current = false; setHelpSession(value => value + 1); setHelpId(id);
    });
  }
  async function generate(task: RecordData) {
    if (!closeHelp()) return;
    if (draftEdit && !window.confirm("Discard unsaved message edits and create a plan?")) return;
    const gaps = missingDetails(task);
    if (gaps.length && !window.confirm("Useful details are missing:\n\n" + gaps.join("\n") + "\n\nGenerate a plan using the supplied details?")) return;
    await run(async () => { const plan = await generateAndSaveLocalPlan(store.current, task.id, mode); setSelected(plan); setMessage("Plan saved on this device."); });
  }
  function openPlan(plan: RecordData) {
    if (!closeHelp()) return;
    if (draftEdit && !window.confirm("Discard unsaved message edits and open this plan?")) return;
    setDraftEdit(null); setAiPrompt(null); setSelected(plan);
  }
  async function saveMessage() {
    if (!selected || !draftEdit) return;
    const validation = { subject: draftEdit.subject.trim() ? undefined : "Enter a message subject.", body: draftEdit.body.trim() ? undefined : "Enter the message body." };
    setMessageEditError(validation);
    if (validation.subject || validation.body) return;
    await run(async () => {
      const updated = await store.current.updatePlanMessage(selected.id, {
        subject: draftEdit.subject, body: draftEdit.body,
      }, draftEdit.expected);
      setSelected(updated); setDraftEdit(null); setMessageEditError({}); setAiPrompt(null); setMessage("Message saved on this device. Nothing was sent.");
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
      resetForm(); setSelected(null); setHelpId(null); helpDirty.current = false; setMessage("Backup restored on this device.");
    });
  }

  async function chooseRestore() {
    if (!isNativeDevice()) { fileInput.current?.click(); return; }
    await run(async () => {
      const text = await chooseDeviceBackup();
      if (!text || !window.confirm("Restore replaces every bill and plan on this device. Export your current records first if needed. Replace the current records?")) return;
      await store.current.importBackup(text, { replace: true });
      resetForm(); setSelected(null); setHelpId(null); helpDirty.current = false; setMessage("Backup restored on this device.");
    });
  }

  const visibleBills = sortBills(snapshot.tasks, billSort).filter(task => (billFilter === "all" || (billFilter === "done" ? task.status === "Done" : task.status !== "Done")) && [task.title, task.category, task.details?.provider, task.details?.bill_type, task.details?.service_type].join(" ").toLowerCase().includes(billSearch.trim().toLowerCase()));
  function viewBillResults(task: RecordData) {
    setResultBill(task.id); setResultQuery(""); setResultKind("");
    document.getElementById("saved-results-heading")?.focus();
  }

  return <div style={{ overflowWrap: "anywhere", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }} className="homeadmin-shell min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-violet-100 bg-white px-[20px] py-5"><div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><img src="/homeadmin-logo.png" width="56" height="56" alt="HomeAdmin logo" className="h-[40px] w-[40px] shrink-0 rounded-xl sm:h-14 sm:w-14" /><div className="min-w-0"><p className="font-extrabold text-lg text-violet-800 sm:text-2xl">HomeAdmin</p><p className="text-base text-slate-600">List, plan and save.</p></div></div><a className="min-h-[44px] inline-flex items-center underline font-semibold text-violet-800" href="https://tenaciouspl.co.uk" target="_blank" rel="noopener noreferrer">Examples & support</a></div></header>
    <main className="mx-auto max-w-6xl px-[20px] py-8 space-y-6">
      <h1 className="sr-only">HomeAdmin household bills</h1>
      <nav aria-label="Household sections" className="flex flex-wrap gap-2">{[["overview", "Overview"], ["saved-bills", "Bills"], ["saved-plans", "Plans"], ["household-diary", "Diary"], ["device-data", "Data & backups"]].map(([id, label]) => <a key={id} className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 font-semibold text-violet-900 hover:bg-violet-50" href={"#" + id}>{label}</a>)}</nav>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}{!ready && <button className={button + " ml-3"} onClick={() => setRetry(value => value + 1)}>Retry storage</button>}</div>}
      {message && <p role="status" className="rounded-xl bg-teal-100 p-4 text-teal-950">{message}</p>}
      {!ready && !error && <p role="status" aria-busy="true" className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-5 text-violet-900"><LoadingSpinner />Opening your device records…</p>}
      {busy && <p role="status" aria-busy="true" className="flex items-center gap-2 text-sm font-semibold text-violet-900"><LoadingSpinner />Saving on this device…</p>}
      {ready && <>
      <fieldset disabled={busy} className="min-w-0 space-y-6 border-0 p-0" aria-busy={busy}>
        <BillOverview tasks={snapshot.tasks} onHelp={showHelp} onEdit={edit} onAdd={() => { resetForm(); document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth" }); }} />
        <section className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm">
          <h2 className="text-xl font-bold">Find a bill or provider</h2>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setMatch(suggest(search)); }}><label className="sr-only" htmlFor="bill-search">Bill or provider</label><input id="bill-search" className={input} value={search} maxLength={500} placeholder="e.g. Cancel Netflix or review energy" onChange={event => setSearch(event.target.value)} /><button className={button}>Search</button></form>
          {match && <div className="mt-4"><p>{match.category_id ? catalogue.categories.find((item: any) => item.id === match.category_id)?.label : "Choose the closest bill type below."}</p>{match.category_id && <button className={button + " mt-2"} onClick={() => { resetForm(); setCategory(match.category_id); setGoal(match.goal_id || ""); const suggestedDetails = { ...(match.prefill_details || {}) }; const resolved = billTypeForSuggestion(match.category_id, search, suggestedDetails); const suggestedGroup = resolved?.group || groupForCategory(match.category_id); if (suggestedGroup) suggestedDetails.bill_group_id = suggestedGroup.id; if (resolved) Object.assign(suggestedDetails, { bill_type_id: resolved.type.id, bill_type: resolved.type.label, [resolved.type.detail_key]: resolved.type.detail_value }); setDetails(suggestedDetails); setMatch(null); document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth" }); }}>Use suggestion</button>}</div>}
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Popular bill types">{[["electricity", "Electricity"], ["gas", "Gas"], ["water", "Water"], ["broadband", "Broadband"], ["mobile", "Mobile"], ["rent", "Rent"], ["mortgage", "Mortgage"]].map(([id, label]) => <button key={id} className="min-h-[44px] rounded-xl border border-violet-200 px-4 font-semibold text-violet-800 hover:bg-violet-50" onClick={() => quickAddBill(id)}>{label}</button>)}</div>
        </section>
        <section id="bill-form" className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm">
          <h2 className="text-xl font-bold">{editing ? "Edit bill" : "Add a bill"}</h2>
          <form noValidate className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
            <div className="grid gap-4 sm:grid-cols-2"><label>Bill category<select id="bill_group_id" required aria-invalid={!!fieldErrors.bill_group_id} aria-describedby={fieldErrors.bill_group_id ? "bill_group_id-error" : undefined} className={input + " mt-1"} value={selectedBillGroup?.id || ""} onChange={event => chooseBillGroup(event.target.value)}><option value="">Choose a category</option>{billGroups.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{fieldErrors.bill_group_id && <span id="bill_group_id-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">{fieldErrors.bill_group_id}</span>}</label><label>Which bill is it?<select id="bill_type_id" disabled={!selectedBillGroup} required aria-invalid={!!fieldErrors.bill_type_id} aria-describedby={fieldErrors.bill_type_id ? "bill_type_id-error" : undefined} className={input + " mt-1"} value={selectedBillType?.id || ""} onChange={event => chooseBillType(event.target.value)}><option value="">{selectedBillGroup ? "Choose a bill" : "Choose a category first"}</option>{selectedBillGroup?.types.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{fieldErrors.bill_type_id && <span id="bill_type_id-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">{fieldErrors.bill_type_id}</span>}</label></div><div className="grid gap-4 sm:grid-cols-2"><label>What would you like help with?<select id="goal_id" disabled={!category} required aria-invalid={!!fieldErrors.goal_id} aria-describedby={fieldErrors.goal_id ? "goal_id-error" : undefined} className={input + " mt-1"} value={goal} onChange={event => { setGoal(event.target.value); setFieldErrors(previous => ({ ...previous, goal_id: "" })); setError(""); }}><option value="">{category ? "Choose what you need" : "Choose a bill first"}</option>{availableGoals.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{fieldErrors.goal_id && <span id="goal_id-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">{fieldErrors.goal_id}</span>}</label></div>
            <label className="block">Bill name<input className={input + " mt-1"} value={title} maxLength={160} placeholder={category === "water" ? "e.g. United Utilities water bill" : category === "energy_water" ? "e.g. Electricity at home" : "Optional name for your bill"} onChange={event => setTitle(event.target.value)} /></label>
            {category && <p className="text-sm text-slate-600">{selectedBillType?.label ? `${selectedBillType.label}. ` : ""}Set the country and currency for this bill. English-language guidance is currently available; local provider rules require verification. Existing records retain their original amounts.</p>}{category === "water" && <p className="rounded-xl bg-violet-50 p-3 text-violet-950">Water bills have their own charging rules. Start with your company, region and charging basis; choose Not sure wherever needed.</p>}
            <p className="text-base text-slate-600">Add the details you know. Leave the rest blank. Avoid passwords, full card numbers and security codes.</p>
            <div className="grid gap-4 sm:grid-cols-2">{primaryFields.filter((field: any) => field.id !== selectedBillType?.detail_key).map(renderField)}</div>
            {additionalFields.filter((field: any) => field.id !== selectedBillType?.detail_key).length > 0 && <details className="rounded-xl border border-violet-100 p-4"><summary className="min-h-[44px] cursor-pointer font-semibold">More bill details (optional)</summary><div className="grid gap-4 sm:grid-cols-2">{additionalFields.filter((field: any) => field.id !== selectedBillType?.detail_key).map(renderField)}</div></details>}
            <details className="min-w-0 rounded-xl border border-violet-100 p-4"><summary className="min-h-[44px] cursor-pointer font-semibold">{category === "water" ? "Follow-up reminder" : "Contract dates and diary"}</summary><div className="grid gap-4 sm:grid-cols-2">{diaryDates.filter(field => category !== "water" || field.id === "follow_up_date").map(field => <label key={field.id} className="block min-w-0">{field.label}<input id={field.id} type="date" aria-invalid={!!fieldErrors[field.id]} aria-describedby={fieldErrors[field.id] ? field.id + "-error" : undefined} className={input + " mt-1 appearance-none"} value={details[field.id] || ""} onChange={event => { setDetails(value => ({ ...value, [field.id]: event.target.value })); setFieldErrors(previous => ({ ...previous, [field.id]: "" })); setError(""); }} />{fieldErrors[field.id] && <span id={field.id + "-error"} role="alert" className="mt-1 block text-sm font-semibold text-red-800">{fieldErrors[field.id]}</span>}</label>)}</div><label className="mt-3 flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={details.diary_enabled === "yes"} onChange={event => setDetails(value => ({ ...value, diary_enabled: event.target.checked ? "yes" : "no" }))} />Create diary entries for this bill after connecting a calendar</label><label className="mt-3 block">Reminder before each diary date<select className={input + " mt-1"} value={details.diary_lead_days || "14"} onChange={event => setDetails(value => ({ ...value, diary_lead_days: event.target.value }))}>{[["0", "On the day"], ["7", "7 days before"], ["14", "14 days before"], ["30", "30 days before"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="mt-3 text-slate-600">Save dates here, then use Contract diary below to enable calendar access. Calendar alerts depend on device settings.</p></details>
            <label className="block">Additional notes<textarea className={input + " mt-1"} rows={3} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
            <div className="flex gap-3"><button className={button}>{busy ? <span className="inline-flex items-center gap-2"><LoadingSpinner />Saving…</span> : "Save bill"}</button>{editing && <button type="button" className={button} onClick={resetForm}>Cancel edit</button>}</div>
          </form>
        </section>
        {helpTask && <BillHelp key={helpTask.id + ":" + helpSession} task={helpTask} onDirty={value => { helpDirty.current = value; }} onClose={() => { if (closeHelp()) document.getElementById("saved-bills")?.scrollIntoView({ behavior: "smooth" }); }} onEdit={() => edit(helpTask)} onProgress={draft => saveHelpProgress(helpTask, draft)} onSave={(draft, service) => saveHelpResult(helpTask, draft, service)} />}
        <section id="saved-bills" className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm"><h2 className="text-xl font-bold">{`Your bills (${snapshot.tasks.length})`}</h2>{snapshot.tasks.length > 0 && <><div className="mt-4 grid gap-3 sm:grid-cols-2"><label>Search saved bills<input className={input + " mt-1"} value={billSearch} onChange={event => setBillSearch(event.target.value)} placeholder="Bill name, provider or category" /></label><label>Show bills<select className={input + " mt-1"} value={billFilter} onChange={event => setBillFilter(event.target.value)}><option value="active">Active</option><option value="done">Completed</option><option value="all">All bills</option></select></label></div><label className="mt-3 block max-w-sm">Sort bills<select className={input + " mt-1"} value={billSort} onChange={event => setBillSort(event.target.value)}><option value="next_date">Next date first</option><option value="name">Bill name</option><option value="cost">Highest monthly cost within each currency</option></select></label>{billSort === "cost" && <p className="mt-2 text-slate-600">Each currency is grouped separately. Bills without a recurring-cost estimate appear last.</p>}<p className="mt-3 text-base text-slate-600">Start with Create a plan or message beside a bill. Follow the steps, then save your answer. Create offline template is a separate offline template. Mark done records a completed task, not a payment.</p><details className="mt-4"><summary className="cursor-pointer py-3 font-semibold">Optional offline plan settings</summary><p className="mt-2 text-slate-600">Recommended plan works for most bills. Change the template only for a specific need. These settings do not change your AI choice.</p><label className="mt-4 block max-w-sm">Plan focus<select className={input + " mt-1"} value={mode} onChange={event => setMode(event.target.value)}><optgroup label="Everyday bill planning"><option value="full">Recommended plan</option><option value="more_options">Compare approaches</option><option value="renewal_pro">Renew or switch</option><option value="refund_pro">Resolve a problem</option></optgroup><optgroup label="Specialist planning"><option value="document_pro">Review a document</option><option value="travel_pro">Travel admin</option><option value="family_board">Family admin</option><option value="small_landlord">Property admin</option></optgroup></select><span className="mt-1 block text-sm text-slate-600">Choose the focus; HomeAdmin keeps the matching guidance in your plan.</span></label></details></>}{!snapshot.tasks.length && <EmptyState title="No bills yet" description="Add your first bill to keep its cost, dates and next steps together." action="Add a bill" onAction={() => document.getElementById("bill-form")?.scrollIntoView({ behavior: "smooth" })} />}{snapshot.tasks.length > 0 && !visibleBills.length && <div className="mt-4 rounded-xl bg-slate-50 p-4"><p>No bills match your search and status filter.</p><button className={button + " mt-3"} onClick={() => { setBillSearch(""); setBillFilter("all"); }}>Show all bills</button></div>}<ul className="mt-4 space-y-3">{visibleBills.map(task => <li key={task.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">{task.title}</h3><p className="text-base text-slate-600">{`${task.details?.bill_type || catalogue.categories.find((item: any) => item.id === billCategory(task))?.label || task.category} · ${task.status}`}</p><p className="mt-2 font-semibold text-violet-900">{recurringCost(task) ? money(recurringCost(task)!.amount, task.details.currency) + " · " + task.details.billing_frequency : task.details?.amount || "Cost not recorded"}</p>{!task.details?.bill_type && task.details?.service_type && <p className="text-sm text-slate-600">{task.details.service_type}</p>}<div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => showHelp(task)}>{task.workflow_draft ? "Resume bill help" : "Create a plan or message"}</button><button className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700" onClick={() => void generate(task)}>Create offline template</button></div>{snapshot.plans.some(plan => plan.task_id === task.id) && <button className="mt-3 min-h-[44px] rounded-xl border border-violet-200 px-4 py-2 font-semibold text-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700" onClick={() => viewBillResults(task)}>View saved results ({snapshot.plans.filter(plan => plan.task_id === task.id).length})</button>}<details className="mt-2"><summary className="w-fit cursor-pointer rounded-lg px-2 py-3 font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700">Manage bill</summary><div className="mt-1 flex flex-wrap gap-2"><button className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800" onClick={() => edit(task)}>Edit</button><button className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800" onClick={() => void run(async () => { await store.current.updateTask(task.id, { status: task.status === "Done" ? "Open" : "Done" }); setMessage("Bill status saved."); })}>{task.status === "Done" ? "Reopen" : "Mark done"}</button><button className="min-h-[44px] rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-800" onClick={() => { if (window.confirm("Delete this bill and every associated plan?")) void run(async () => { await store.current.deleteTask(task.id); if (selected?.task_id === task.id) setSelected(null); if (editing === task.id) resetForm(); setMessage("Bill and associated plans deleted."); }); }}>Delete bill</button></div></details></li>)}</ul></section>
        <SavedResults plans={snapshot.plans} tasks={snapshot.tasks} query={resultQuery} billId={resultBill} kind={resultKind} onQuery={setResultQuery} onBill={setResultBill} onKind={setResultKind} onOpen={openPlan} onDelete={plan => { if (window.confirm("Delete this saved result?")) void run(async () => { await store.current.deletePlan(plan.id); if (selected?.id === plan.id) setSelected(null); setMessage("Saved result deleted."); }); }} />
        {selected && <section className="rounded-2xl border border-teal-200 bg-white p-[20px] shadow-sm"><h2 id="local-plan-heading" tabIndex={-1} className="text-xl font-bold focus-visible:outline focus-visible:outline-violet-700">{selected.title}</h2><p className="mt-3 rounded-xl bg-slate-100 p-3">{selected.source === "external_ai_manual" ? "AI-service answer supplied and reviewed by you. HomeAdmin has not independently verified the answer." : selected.source === "external_ai_api" ? "Draft generated by Google Gemini after your approval. HomeAdmin has not independently verified the answer." : selected.source === "local" ? "Offline draft using local templates, not an AI-generated response." : "Saved draft. Preparation source was not recorded; review before use."}</p>{selected.missing_details?.length > 0 && <p className="mt-3 text-amber-900">Useful missing details: {selected.missing_details.join(", ")}</p>}<p className="mt-3 text-base text-slate-600">General guidance only. Confirm current provider terms and official information before acting. Nothing is sent automatically.</p>{Object.entries(selected.sections || {}).filter(([key, value]) => String(value).trim() && !(key === "provider_message" && selected.provider_email)).map(([key, value]) => <section key={key} className="mt-5"><h3 className="font-bold capitalize">{key.replaceAll("_", " ")}</h3><PlanText text={String(value)} /></section>)}{!Object.values(selected.sections || {}).some(value => String(value).trim()) && selected.content && <PlanText text={String(selected.content)} />}{selected.provider_email && <section className="mt-5"><h3 className="font-bold">{selected.provider_email.kind === "bank_query" ? "Bank-query draft" : selected.workflow_output === "reply" ? "Reply draft" : "Provider-message draft"}</h3>{draftEdit ? <form noValidate className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void saveMessage(); }}><p className="text-base text-slate-600">Edits stay here until saved. Nothing is sent automatically.</p><label className="block">Message subject<input className={input + " mt-1"} required aria-invalid={Boolean(messageEditError.subject)} aria-describedby={messageEditError.subject ? "message-subject-error" : undefined} maxLength={200} value={draftEdit.subject} onChange={event => { setDraftEdit(value => value && ({ ...value, subject: event.target.value })); setMessageEditError(value => ({ ...value, subject: undefined })); }} />{messageEditError.subject && <span id="message-subject-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">{messageEditError.subject}</span>}</label><label className="block">Message body<textarea className={input + " mt-1"} required aria-invalid={Boolean(messageEditError.body)} aria-describedby={messageEditError.body ? "message-body-error" : undefined} rows={10} maxLength={20000} value={draftEdit.body} onChange={event => { setDraftEdit(value => value && ({ ...value, body: event.target.value })); setMessageEditError(value => ({ ...value, body: undefined })); }} />{messageEditError.body && <span id="message-body-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">{messageEditError.body}</span>}</label><div className="flex flex-wrap gap-3"><button className={button}>Save message</button><button type="button" className={button} onClick={() => { setDraftEdit(null); setMessageEditError({}); }}>Cancel message edit</button></div></form> : <><p className="mt-2 font-semibold">{selected.provider_email.subject}</p><p className="mt-2 whitespace-pre-wrap">{selected.provider_email.body}</p><button className={button + " mt-3"} onClick={() => { setAiPrompt(null); setMessageEditError({}); setDraftEdit({ subject: selected.provider_email.subject, body: selected.provider_email.body, expected: { ...selected.provider_email } }); }}>Edit message</button></>}</section>}<button disabled={draftEdit !== null} className={button + " mt-4 mr-3"} onClick={() => void run(async () => { await copyDeviceText(planTextForCopy(selected)); setMessage("Plan copied. Review before sharing."); })}>Copy plan</button>{selected.provider_email && <button disabled={draftEdit !== null} className={button + " mt-4 mr-3"} onClick={() => void run(async () => { await copyDeviceText("Subject: " + selected.provider_email.subject + "\n\n" + selected.provider_email.body); setMessage("Message copied. Review before sending."); })}>Copy message</button>}<button disabled={draftEdit !== null} className={button + " mt-4 mr-3"} onClick={() => void run(async () => { setAiPrompt(""); })}>Prepare AI prompt</button>{resultTask && <section className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4" aria-label="Next actions for this bill"><h3 className="font-bold">What happens next?</h3><p className="mt-2">Keep working with this bill. Add a follow-up date while editing the bill, or prepare another plan, letter or reply. Saving a draft does not mean a message was sent or the issue was resolved.</p><div className="mt-3 flex flex-wrap gap-3"><button disabled={draftEdit !== null} className={button} onClick={() => edit(resultTask)}>Update bill or follow-up date</button><button disabled={draftEdit !== null} className={button} onClick={() => { setAiPrompt(null); showHelp(resultTask); }}>Create another plan or message</button></div></section>}{aiPrompt !== null && <AiHandoff key={selected.id} plan={selected} onMessage={setMessage} onError={setError} onClose={() => { setAiPrompt(null); document.getElementById("local-plan-heading")?.focus(); }} />}</section>}
        <div id="household-diary"><DiaryPanel tasks={snapshot.tasks} /></div>
        <section id="device-data" className="rounded-2xl border border-violet-100 bg-white p-[20px] shadow-sm"><h2 className="text-xl font-bold">Your data and backups</h2><p className="mt-3 text-slate-600">TenaciousPL holds no recovery copy of your household records. Device cloud backups depend on your settings and the final app package. Export a private copy before deleting the app or changing devices.</p><button className={button + " mt-4"} onClick={() => setBackups(value => !value)}>{backups ? "Hide backup controls" : "Manage backups"}</button>{backups && <div className="mt-4 space-y-3"><p>Backup files contain readable personal information. Keep your chosen copy private. Restore replaces existing bills and plans.</p><div className="flex flex-wrap gap-3"><button className={button} onClick={() => void exportBackup()}>Export backup</button><button className={button} onClick={() => void chooseRestore()}>Restore backup</button><input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importBackup(file); }} /><button className={button} onClick={() => { if (window.confirm("Delete every bill and plan on this device? Export a backup first if needed.")) void run(async () => { await store.current.clear(); resetForm(); setSelected(null); setMessage("All device records deleted."); }); }}>Delete all records</button></div></div>}</section>
      </fieldset>
      </>}
    </main><footer className="mx-auto max-w-6xl px-[20px] py-8 text-base text-slate-600"><p>TenaciousPL support</p><div className="mt-3 flex flex-wrap gap-3"><a className={button + " inline-flex items-center"} href="mailto:tenaciouspl@icloud.com" aria-label="Email TenaciousPL support">Email support</a><a className={button + " inline-flex items-center"} href="https://tenaciouspl.co.uk/app-privacy.html" target="_blank" rel="noopener noreferrer">App privacy policy</a></div></footer>
  </div>;
}

function PlanText({ text }: { text: string }) {
  return <div className="mt-2 leading-relaxed">{text.replace(/^##\s+(Next steps|Provider message|Things to check|Approval checklist)\s*\n/i, "").split(/\r?\n/).map((line, index) => {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) return <h4 key={index} className="mt-4 mb-2 font-semibold">{heading[1]}</h4>;
    return line.trim() ? <p key={index} className="my-2 whitespace-pre-wrap break-words">{line.split(/(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>]+)/g).map((part, partIndex) => {
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      const url = link?.[2] || (/^https?:\/\//.test(part) ? part : "");
      if (!url) return part;
      try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) return part; } catch { return part; }
      return <a key={partIndex} className="font-semibold text-violet-800 underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">{link?.[1] || url}</a>;
    })}</p> : null;
  })}</div>;
}

undefined



