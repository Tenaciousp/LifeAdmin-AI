import { useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "./Feedback";
import { aiServices, preferredAi, savePreferredAi } from "./lib/offline/ai-handoff.mjs";
import { initialWorkflow, languages, localWorkflowDraft, outputs, tones, workflowContext, workflowFields, workflowPrompt } from "./lib/offline/bill-workflow.mjs";
import type { WorkflowDraft } from "./lib/offline/bill-workflow.mjs";
import { copyDeviceText } from "./lib/offline/device-files.mjs";
import { aiDraftConfigured, generateWithGemini } from "./lib/offline/ai-generation.mjs";

const button = "min-h-[44px] max-w-full rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:opacity-50";
const secondary = "min-h-[44px] max-w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
const input = "mt-1 box-border min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
function preferences() { try { return window.localStorage; } catch { return null; } }

export default function BillHelp({ task, onClose, onEdit, onProgress, onSave, onDirty }: {
  task: any; onClose: () => void; onEdit: () => void;
  onProgress: (draft: WorkflowDraft) => Promise<void>;
  onSave: (draft: WorkflowDraft, service: string) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<WorkflowDraft>(() => {
    const saved = initialWorkflow(task);
    return saved.method === "gemini_api" && !aiDraftConfigured() && saved.step !== 4
      ? { ...saved, method: "chosen_ai", step: 1 } : saved;
  });
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [service, setService] = useState(() => preferredAi(preferences()));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [geminiConsent, setGeminiConsent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const fields = workflowFields(task);
  const includedFields = fields.filter(field => draft.method === "local" || draft.fieldKeys.includes(field.key));
  const selectedService = aiServices.find(item => item.id === service)!;
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [draft.step]);
  function change(patch: Partial<WorkflowDraft>) { setFactsConfirmed(false); setDraft(value => ({ ...value, ...patch, reviewed: false })); setGeminiConsent(false); setStatus(""); setError(""); onDirty(true); }
  async function act(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setWorking(true); setError(""); setStatus("");
    try { await operation(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to complete this step. Your entered text is still here."); }
    finally { pending.current = false; setWorking(false); }
  }
  async function saveProgress() { await onProgress(draft); onDirty(false); setStatus("Progress saved on this device. Resume from this bill after reopening HomeAdmin."); }
  function prepare() {
    try {
      if (draft.method !== "local") { workflowPrompt(task, draft); change({ step: 3 }); }
      else { const local = localWorkflowDraft(task, draft.output, draft.brief); change({ ...local, step: 4 }); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Check your choices before continuing."); }
  }
  function revise() {
    if (draft.body.trim() && !window.confirm("Revise the request and clear the current result? Save progress first to keep your current text.")) return;
    change({ step: 2, body: "", subject: "" });
  }
  let prompt = "";
  if (draft.step === 3) { try { prompt = workflowPrompt(task, draft); } catch { /* The next-step action displays the actionable validation message. */ } }
  return <section id="bill-help" aria-labelledby="bill-help-heading" className="rounded-2xl border-2 border-violet-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 ref={heading} id="bill-help-heading" tabIndex={-1} className="text-2xl font-bold focus-visible:outline focus-visible:outline-violet-700">Help with {task.title}</h2><p className="mt-2 text-slate-600">One bill, one clear outcome. Your progress stays linked to this bill.</p></div><button className={secondary} disabled={working} onClick={onClose}>Close bill help</button></div>
    <ol aria-label="Bill help progress" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{["Choose result", "Check bill details", "Ask your AI", "Check answer & save"].map((label, i) => <li key={label} aria-current={draft.step === i + 1 ? "step" : undefined} className={"rounded-xl p-3 font-semibold " + (draft.step === i + 1 ? "bg-violet-100 text-violet-950" : "bg-slate-100 text-slate-600")}>{`${i + 1}. ${label}`}</li>)}</ol>
    {working && <p role="status" aria-busy="true" className="mt-4 flex items-center gap-2 rounded-xl bg-violet-50 p-4 font-semibold text-violet-900"><LoadingSpinner />Working on your draft…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}{status && <p role="status" className="mt-4 rounded-xl bg-teal-50 p-4 text-teal-950">{status}</p>}
    <fieldset disabled={working} className="mt-5 min-w-0 space-y-4 border-0 p-0" aria-busy={working}>
      {draft.step === 1 && <>
        <fieldset className="min-w-0"><legend className="text-xl font-bold">What would you like to create?</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{outputs.map(output => <label key={output.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-4 " + (draft.output === output.id ? "border-violet-700 bg-violet-50" : "border-slate-200")}><input type="radio" name="bill-help-output" className="mt-1 h-5 w-5 shrink-0" checked={draft.output === output.id} onChange={() => change({ output: output.id, body: "", subject: "" })} /><span><strong className="block">{output.label}</strong><span className="mt-1 block">{output.description}</span></span></label>)}</div></fieldset>
        <fieldset className="min-w-0"><legend className="text-xl font-bold">Prepare with</legend>
          <label className="mt-3 flex min-h-[44px] items-center gap-3"><input type="radio" name="bill-help-method" className="h-5 w-5 shrink-0" checked={draft.method === "chosen_ai"} onChange={() => change({ method: "chosen_ai" })} /><strong>Use my chosen AI service</strong></label>
          {draft.method === "chosen_ai" && <label className="mt-3 block">Your AI service<select className={input} value={service} onChange={event => { setService(event.target.value); try { savePreferredAi(preferences(), event.target.value); } catch (failure) { setError(failure instanceof Error ? failure.message : "AI preference was not saved."); } }}>{aiServices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-2 block text-slate-600">We remember your choice. Use your own free or paid AI account.</span></label>}
          <details className="mt-4 rounded-xl border border-slate-200 p-3" open={draft.method !== "chosen_ai" ? true : undefined}><summary className="cursor-pointer font-semibold">Other ways to prepare a draft</summary>
            {aiDraftConfigured() && <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "gemini_api"} onChange={() => change({ method: "gemini_api" })} /><span><strong className="block">Generate a draft in HomeAdmin with Google Gemini</strong>Review and approve sharing before generating.</span></label>}
            <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "local"} onChange={() => change({ method: "local" })} /><span><strong className="block">Start from an offline draft</strong>A template for you to personalise.</span></label>
          </details>
        </fieldset>
        <p className="text-slate-600">{draft.method === "chosen_ai" ? "Next: check your bill details, copy the request into your AI, then bring the answer back to review and save." : "Next: check your bill details and prepare a draft for review."}</p>
        <button className={button} onClick={() => change({ step: 2 })}>Continue to details</button>
      </>}
      {draft.step === 2 && <>
        <h3 className="text-xl font-bold">Check the facts and tell us the outcome</h3><p>{workflowContext(task)} {draft.method === "local" ? "These choices provide context for your offline draft." : "This category and goal are included in the AI request alongside the details you choose below."}</p><button className={secondary} onClick={onEdit}>Edit this bill</button>
        <label className="block font-semibold">What outcome do you want?<textarea className={input + " font-normal"} rows={3} maxLength={2000} value={draft.brief} placeholder={draft.output === "reply" ? "e.g. Explain why the reply has not resolved my meter-reading query" : "e.g. Explain the price rise and request an itemised bill"} onChange={event => change({ brief: event.target.value })} /></label>
        <p>Include key dates and the specific question. Avoid passwords, security codes, full payment-card numbers and unnecessary personal information.</p>
        {draft.output === "reply" && <label className="block font-semibold">Provider message to respond to<textarea className={input + " font-normal"} rows={6} maxLength={10000} aria-invalid={draft.output === "reply" && error.includes("Paste the provider message")} aria-describedby={draft.output === "reply" && error.includes("Paste the provider message") ? "incoming-error" : undefined} value={draft.incoming} placeholder="Paste the relevant message. Remove signatures, addresses, account numbers and unrelated conversation first." onChange={event => change({ incoming: event.target.value })} />{draft.output === "reply" && error.includes("Paste the provider message") && <span id="incoming-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">A provider message is required for a reply.</span>}<span className="mt-2 block font-normal">For the AI route, this text and your requested outcome appear in the request you review before copying. The offline reply is a starting template, not an analysis of the message.</span></label>}
        {draft.method !== "local" && <>
          <div className="grid gap-4 sm:grid-cols-2"><label>Response tone<select className={input} value={draft.tone} onChange={event => change({ tone: event.target.value })}>{tones.map(tone => <option key={tone}>{tone}</option>)}</select></label><label>Response language<select className={input} value={draft.language} onChange={event => change({ language: event.target.value })}>{languages.map(language => <option key={language}>{language}</option>)}</select></label></div>
          <fieldset className="min-w-0"><legend className="font-bold">Choose bill details for the AI request</legend><p className="mt-2">Only checked details are included. Account references and free-text notes start unchecked. Your entered outcome and provider message are included separately.</p>{fields.length ? fields.map(field => <label key={field.key} className="mt-2 flex min-h-[44px] items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.fieldKeys.includes(field.key)} onChange={event => change({ fieldKeys: event.target.checked ? [...draft.fieldKeys, field.key] : draft.fieldKeys.filter(key => key !== field.key) })} /><span className="min-w-0"><strong>{field.label}</strong><span className="block whitespace-pre-wrap">{field.value}</span></span></label>) : <p className="mt-2">No bill details supplied yet. Edit the bill or describe the key facts in your outcome.</p>}</fieldset>
        </>}
        {draft.method === "local" && <p>Offline drafts use the saved bill details and English templates. Read every section and replace placeholders. No information is shared with an AI service.</p>}
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => change({ step: 1 })}>Back to choices</button><button className={button} onClick={prepare}>{draft.method === "local" ? "Prepare offline draft" : "Review AI request"}</button></div>
      </>}
      {draft.step === 3 && draft.method === "chosen_ai" && <>
        <h3 className="text-xl font-bold">Review, copy and open your AI</h3><label className="block">Chosen AI service<select className={input} value={service} onChange={event => { setService(event.target.value); try { savePreferredAi(preferences(), event.target.value); } catch (failure) { setError(failure instanceof Error ? failure.message : "AI preference was not saved."); } }}>{aiServices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <ol className="list-decimal space-y-2 pl-6"><li>Check the request below, then press <strong>Copy AI request</strong>.</li><li>Open your AI, paste the request into a new chat and send.</li><li>Copy the answer from your AI, return to HomeAdmin and press <strong>I have an answer to review</strong>.</li></ol>
        <p className="text-slate-600">Copying saves your progress. Your AI receives the request when you paste and send. Answers return through copy and paste.</p>
        <label className="block">Prepared AI request<textarea className={input} readOnly rows={10} value={prompt} /></label>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={!prompt} onClick={() => void act(async () => { await onProgress(draft); onDirty(false); await copyDeviceText(prompt); setStatus("AI request copied and progress saved. Open your AI, paste the request, then return with the answer."); })}>Copy AI request</button><a className={button + " inline-flex items-center"} href={selectedService.url} target="_blank" rel="noopener noreferrer">Open {selectedService.name}</a><button className={secondary} onClick={() => change({ step: 2 })}>Change request details</button></div>
        <button className={button} onClick={() => change({ step: 4 })}>I have an answer to review</button>
      </>}
      {draft.step === 3 && draft.method === "gemini_api" && <>
        <h3 className="text-xl font-bold">Review the request before generating</h3>
        <p>The checked bill details, your requested outcome and any provider message shown below will be sent to HomeAdmin's AI service and then Google Gemini only after you press Generate draft. The service does not save the request. The answer returns here for your review.</p>
        {!aiDraftConfigured() && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-950">In-app Gemini is not configured for this version yet. Use Copilot or an offline draft.</p>}
        <label className="block">Reviewed request<textarea className={input} readOnly rows={10} value={prompt} /></label>
        <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={geminiConsent} onChange={event => setGeminiConsent(event.target.checked)} /><span>I agree to send the request above through HomeAdmin's server to Google Gemini. Google free-tier data terms may allow use of submitted content to improve products. HomeAdmin may enforce usage limits. I removed anything I do not want to share.</span></label>
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => change({ step: 2 })}>Change request details</button><button className={button} disabled={!aiDraftConfigured() || !geminiConsent || !prompt || working} onClick={() => void act(async () => { const result = await generateWithGemini(prompt, draft.output); change({ ...result, step: 4, reviewed: false }); setStatus("Draft generated. Review every fact and edit the wording before saving."); })}>{working ? <span className="inline-flex items-center gap-2"><LoadingSpinner />Generating draft…</span> : "Generate draft with Gemini"}</button></div>
      </>}
      {draft.step === 4 && <>
        <h3 className="text-xl font-bold">{draft.method === "local" ? "Personalise your offline draft" : draft.method === "gemini_api" ? "Review your Gemini draft" : "Paste and review your AI answer"}</h3><p>{draft.method === "local" ? "This is a local template, not an AI-generated response." : draft.method === "gemini_api" ? "Generated by Google Gemini from the request you approved. HomeAdmin has not independently verified the answer." : "Paste the answer from your chosen AI. HomeAdmin does not fetch or verify the answer automatically."} Saving keeps a separate result linked to this bill, without replacing earlier plans.</p>
        {draft.output !== "plan" && <label className="block">Result subject<input aria-label="Result subject" className={input} maxLength={200} aria-invalid={!draft.subject.trim()} value={draft.subject} onChange={event => change({ subject: event.target.value })} />{!draft.subject.trim() && <span className="mt-1 block text-sm text-amber-900">Add a subject before saving.</span>}</label>}
        <label className="block">{draft.output === "plan" ? "Plan text" : "Message text"}<textarea aria-label={draft.output === "plan" ? "Plan text" : "Message text"} className={input} rows={12} maxLength={20000} aria-invalid={!draft.body.trim()} value={draft.body} onChange={event => change({ body: event.target.value })} />{!draft.body.trim() && <span className="mt-1 block text-sm text-amber-900">Add a {draft.output === "plan" ? "plan" : "message"} before saving.</span>}</label>
        <fieldset className="min-w-0 rounded-xl border border-violet-200 bg-violet-50 p-4"><legend className="px-1 font-bold">Check the answer against your bill</legend>
          <p>Compare the answer above with these details. Correct any wrong amounts, dates or provider information in the answer. Missing facts should stay as questions or placeholders.</p>
          <p className="mt-3">{workflowContext(task)}</p>
          <dl className="mt-3 space-y-2">{includedFields.map(field => <div key={field.key} className="rounded-lg bg-white p-3"><dt className="font-semibold">{field.label}</dt><dd className="whitespace-pre-wrap break-words">{field.value}</dd></div>)}</dl>
          {!includedFields.length && <p className="mt-3">No saved bill details were included. Check the answer against your bill or statement.</p>}
          {draft.brief.trim() && <p className="mt-3 whitespace-pre-wrap break-words"><strong>Your requested outcome: </strong>{draft.brief}</p>}
          {draft.output === "reply" && <details className="mt-3"><summary className="cursor-pointer font-semibold">Original provider message</summary><p className="mt-2 whitespace-pre-wrap break-words">{draft.incoming}</p></details>}
          <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={factsConfirmed} onChange={event => { setFactsConfirmed(event.target.checked); setDraft(value => ({ ...value, reviewed: false })); onDirty(true); }} /><span>I have compared this answer with my bill details and corrected any differences.</span></label>
          <p className="mt-2 text-sm text-slate-600">This is your confirmation, not automatic AI verification. Editing the answer resets the checks. Saved bill details stay unchanged.</p>
        </fieldset>
        <label className="flex min-h-[44px] items-start gap-3 rounded-xl bg-amber-50 p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.reviewed} onChange={event => { setDraft(value => ({ ...value, reviewed: event.target.checked })); onDirty(true); }} /><span>I have checked the facts, amounts, dates, local rules and remaining placeholders. Nothing will be sent automatically.</span></label>
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={revise}>Revise the request</button><button className={button} disabled={!factsConfirmed || !draft.reviewed || !draft.body.trim() || draft.output !== "plan" && !draft.subject.trim()} onClick={() => void act(async () => { if (!factsConfirmed) throw new Error("Compare the answer with your bill details before saving."); await onSave(draft, selectedService.name); onDirty(false); })}>Save reviewed result</button></div>
      </>}
      <div className="border-t border-slate-200 pt-4"><button className={secondary} onClick={() => void act(saveProgress)}>Save progress for later</button><p className="mt-2 text-slate-600">Use Save progress before leaving unfinished work. Saved progress and results are included in your private bill backup.</p></div>
    </fieldset>
  </section>;
}
