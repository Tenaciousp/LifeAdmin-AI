import { useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "./Feedback";
import { aiServices, preferredAi, savePreferredAi } from "./lib/offline/ai-handoff.mjs";
import { initialWorkflow, languages, localWorkflowDraft, outputs, tones, workflowContext, workflowFields, workflowPrompt } from "./lib/offline/bill-workflow.mjs";
import type { WorkflowDraft } from "./lib/offline/bill-workflow.mjs";
import { copyDeviceText } from "./lib/offline/device-files.mjs";
import { aiDraftAvailable, aiDraftConfigured, generateWithGemini } from "./lib/offline/ai-generation.mjs";

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
  const [service, setService] = useState(() => preferredAi(preferences()));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [geminiConsent, setGeminiConsent] = useState(false);
  const [generationAvailable, setGenerationAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void aiDraftAvailable().then(available => { if (active) setGenerationAvailable(available); });
    return () => { active = false; };
  }, []);

  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const fields = workflowFields(task);
  const includedFields = fields.filter(field => draft.method === "local" || draft.fieldKeys.includes(field.key));
  const selectedService = aiServices.find(item => item.id === service)!;
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [draft.step]);
  function change(patch: Partial<WorkflowDraft>) { setDraft(value => ({ ...value, ...patch, reviewed: false })); setGeminiConsent(false); setStatus(""); setError(""); onDirty(true); }
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
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 ref={heading} id="bill-help-heading" tabIndex={-1} className="text-2xl font-bold focus-visible:outline focus-visible:outline-violet-700">Help with {task.title}</h2><p className="mt-2 text-slate-600">Choose what you need. We will guide you one step at a time.</p></div><button className={secondary} disabled={working} onClick={onClose}>Close bill help</button></div>
    <p className="mt-4 font-semibold text-violet-900">Step {draft.step} of 4</p>
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
            {generationAvailable && <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "gemini_api"} onChange={() => change({ method: "gemini_api" })} /><span><strong className="block">Generate a draft in HomeAdmin with Google Gemini</strong>Review and approve sharing before generating.</span></label>}
            <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "local"} onChange={() => change({ method: "local" })} /><span><strong className="block">Start from an offline draft</strong>A template for you to personalise.</span></label>
          </details>
        </fieldset>
        <p className="text-slate-600">{draft.method === "chosen_ai" ? "Next: check your bill details, copy the request into your AI, then bring the answer back to review and save." : "Next: check your bill details and prepare a draft for review."}</p>
        <button className={button} onClick={() => change({ step: 2 })}>Continue to details</button>
      </>}
      {draft.step === 2 && <>
        <h3 className="text-xl font-bold">Check your bill and choose what you need</h3><p>{workflowContext(task)} {draft.method === "local" ? "These choices provide context for your offline draft." : "This category and goal are included in the AI request alongside the details you choose below."}</p><button className={secondary} onClick={onEdit}>Edit this bill</button>
        <label className="block font-semibold">Choose a starting point<select className={input} value="" onChange={event => { if (event.target.value) change({ brief: event.target.value }); }}><option value="">Choose an example, or write your own below</option>{(draft.output === "plan" ? ["Explain my bill and give me a simple action list.", "Help me reduce the cost and compare suitable options.", "Help me prepare for my renewal."] : draft.output === "reply" ? ["Explain the provider message and ask about anything unclear.", "Ask for a better offer without accepting the current offer.", "Explain why the issue is still unresolved."] : ["Ask my provider for a better price.", "Query a charge I do not understand.", "Request a correction to my bill.", "Ask about cancellation terms and any fees."]).map(example => <option key={example}>{example}</option>)}</select></label>
        <label className="block font-semibold">What outcome do you want?<span className="mt-1 block font-normal text-slate-600">Use the example above or describe your request in your own words. For a general plan, leave this blank.</span><textarea className={input + " font-normal"} rows={3} maxLength={2000} value={draft.brief} placeholder={draft.output === "reply" ? "e.g. Explain why the reply has not resolved my meter-reading query" : "e.g. Explain the price rise and request an itemised bill"} onChange={event => change({ brief: event.target.value })} /></label>
        <p>Include key dates and the specific question. Avoid passwords, security codes, full payment-card numbers and unnecessary personal information.</p>
        {draft.output === "reply" && <label className="block font-semibold">Provider message to respond to<textarea className={input + " font-normal"} rows={6} maxLength={10000} aria-invalid={draft.output === "reply" && error.includes("Paste the provider message")} aria-describedby={draft.output === "reply" && error.includes("Paste the provider message") ? "incoming-error" : undefined} value={draft.incoming} placeholder="Paste the relevant message. Remove signatures, addresses, account numbers and unrelated conversation first." onChange={event => change({ incoming: event.target.value })} />{draft.output === "reply" && error.includes("Paste the provider message") && <span id="incoming-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">A provider message is required for a reply.</span>}<span className="mt-2 block font-normal">For the AI route, this text and your requested outcome appear in the request you review before copying. The offline reply is a starting template, not an analysis of the message.</span></label>}
        {draft.method !== "local" && <>
          <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Language and writing style</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><label>Response tone<select className={input} value={draft.tone} onChange={event => change({ tone: event.target.value })}>{tones.map(tone => <option key={tone}>{tone}</option>)}</select></label><label>Response language<select className={input} value={draft.language} onChange={event => change({ language: event.target.value })}>{languages.map(language => <option key={language}>{language}</option>)}</select></label></div></details>
          <fieldset className="min-w-0"><legend className="font-bold">Check the details to include</legend><p className="mt-2">Ticked details go into your request. Untick anything you want to leave out. Use Edit this bill to correct a value. Your request and any provider message are also included.</p>{fields.length ? fields.map(field => <label key={field.key} className="mt-2 flex min-h-[44px] items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.fieldKeys.includes(field.key)} onChange={event => change({ fieldKeys: event.target.checked ? [...draft.fieldKeys, field.key] : draft.fieldKeys.filter(key => key !== field.key) })} /><span className="min-w-0"><strong>{field.label}</strong><span className="block whitespace-pre-wrap">{field.value}</span></span></label>) : <p className="mt-2">No bill details supplied yet. Edit the bill or describe the key facts in your outcome.</p>}</fieldset>
        </>}
        {draft.method === "local" && <p>Offline drafts use the saved bill details and English templates. Read every section and replace placeholders. No information is shared with an AI service.</p>}
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => change({ step: 1 })}>Back to choices</button><button className={button} onClick={prepare}>{draft.method === "local" ? "Prepare offline draft" : "Review AI request"}</button></div>
      </>}
      {draft.step === 3 && draft.method === "chosen_ai" && <>
        <h3 className="text-xl font-bold">Review, copy and open your AI</h3><label className="block">Chosen AI service<select className={input} value={service} onChange={event => { setService(event.target.value); try { savePreferredAi(preferences(), event.target.value); } catch (failure) { setError(failure instanceof Error ? failure.message : "AI preference was not saved."); } }}>{aiServices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <ol className="list-decimal space-y-2 pl-6"><li>Check the request below, then press <strong>Copy AI request</strong>.</li><li>Open your AI, paste the request into a new chat and send.</li><li>Copy the answer from your AI, return to HomeAdmin and press <strong>I have an answer to review</strong>.</li></ol>
        <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">How do I copy, paste and return?</summary><ol className="mt-3 list-decimal space-y-2 pl-6"><li>Press Copy AI request below. This holds the text ready to paste.</li><li>Press Open {selectedService.name}. Sign in to your AI account if asked.</li><li>Tap the message box. On a phone or tablet, touch and hold, then choose Paste. On a computer, use Ctrl+V or Command+V. Press the AI service’s Send button.</li><li>When the answer appears, use the AI service’s Copy button. Switch back to HomeAdmin through your open apps or browser tabs.</li><li>Press I have an answer to review. Paste the answer into the text box.</li></ol><p className="mt-3">If you lose your place, reopen HomeAdmin and choose Resume bill help beside this bill after saving progress.</p></details>
        <p className="text-slate-600">Copying saves your progress. Your AI receives the request when you paste and send. Answers return through copy and paste.</p>
        <label className="block">Prepared AI request<textarea aria-label="Prepared AI request" className={input} readOnly rows={10} value={prompt} /></label>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={!prompt} onClick={() => void act(async () => { await onProgress(draft); onDirty(false); await copyDeviceText(prompt); setStatus("AI request copied and progress saved. Open your AI, paste the request, then return with the answer."); })}>Copy AI request</button><a className={button + " inline-flex items-center"} href={selectedService.url} target="_blank" rel="noopener noreferrer">Open {selectedService.name}</a><button className={secondary} onClick={() => change({ step: 2 })}>Change request details</button></div>
        <button className={button} onClick={() => change({ step: 4 })}>I have an answer to review</button>
      </>}
      {draft.step === 3 && draft.method === "gemini_api" && <>
        <h3 className="text-xl font-bold">Review the request before generating</h3>
        <p>The checked bill details, your requested outcome and any provider message shown below will be sent to HomeAdmin's AI service and then Google Gemini only after you press Generate draft. HomeAdmin does not keep a server copy of the request or answer. Google processes them under its API terms. The answer returns here for your review.</p>
        {!generationAvailable && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-950">In-app generation is unavailable or still being checked. Use your chosen AI service or an offline draft.</p>}
        <div className="flex flex-wrap gap-3" aria-label="Other ways to finish this draft"><button className={secondary} onClick={() => change({ method: "chosen_ai", step: 3 })}>Use my chosen AI instead</button><button className={secondary} onClick={() => change({ method: "local", step: 2 })}>Use an offline draft instead</button></div>
        <label className="block">Reviewed request<textarea className={input} readOnly rows={10} value={prompt} /></label>
        <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={geminiConsent} onChange={event => setGeminiConsent(event.target.checked)} /><span>I agree to send the request above through HomeAdmin's server to Google Gemini. I reviewed the app privacy notice and removed details I do not want to share. HomeAdmin applies usage limits.</span></label>
        <a className="inline-flex min-h-[44px] items-center font-semibold text-violet-800 underline underline-offset-2" href="https://tenaciouspl.co.uk/app-privacy.html" target="_blank" rel="noopener noreferrer">How in-app AI handles your request</a>
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => change({ step: 2 })}>Change request details</button><button className={button} disabled={!generationAvailable || !geminiConsent || !prompt || working} onClick={() => void act(async () => { const result = await generateWithGemini(prompt, draft.output); change({ ...result, step: 4, reviewed: false }); setStatus("Draft generated. Review every fact and edit the wording before saving."); })}>{working ? <span className="inline-flex items-center gap-2"><LoadingSpinner />Generating draft…</span> : "Generate draft with Gemini"}</button></div>
      </>}
      {draft.step === 4 && <>
        <h3 className="text-xl font-bold">{draft.method === "local" ? "Personalise your offline draft" : draft.method === "gemini_api" ? "Review your Gemini draft" : "Paste and review your AI answer"}</h3><p>{draft.method === "local" ? "This is a local template, not an AI-generated response." : draft.method === "gemini_api" ? "Generated by Google Gemini from the request you approved. HomeAdmin has not independently verified the answer." : "Paste the answer from your chosen AI. HomeAdmin does not fetch or verify the answer automatically."} Saving keeps a separate result linked to this bill, without replacing earlier plans.</p>
        <p className="rounded-xl bg-teal-50 p-3">{draft.output === "plan" ? "Keep the action list and explained plan together here. Check any provider offers on the linked official websites before choosing." : "Paste only the letter or email body into Message text. Put the subject in the Result subject box below. Leave the AI’s notes and Details to confirm checklist out of the message you send."}</p>
        {draft.output !== "plan" && <label className="block">Result subject<input aria-label="Result subject" className={input} maxLength={200} aria-invalid={!draft.subject.trim()} value={draft.subject} onChange={event => change({ subject: event.target.value })} />{!draft.subject.trim() && <span className="mt-1 block text-sm text-amber-900">Add a subject before saving.</span>}</label>}
        <label className="block">{draft.output === "plan" ? "Plan text" : "Message text"}<textarea aria-label={draft.output === "plan" ? "Plan text" : "Message text"} className={input} rows={12} maxLength={20000} aria-invalid={!draft.body.trim()} value={draft.body} onChange={event => change({ body: event.target.value })} />{!draft.body.trim() && <span className="mt-1 block text-sm text-amber-900">Add a {draft.output === "plan" ? "plan" : "message"} before saving.</span>}</label>
        <fieldset className="min-w-0 rounded-xl border border-violet-200 bg-violet-50 p-4"><legend className="px-1 font-bold">Check the answer against your bill</legend>
          <p>Compare the answer above with these details. Correct any wrong amounts, dates or provider information in the answer. Missing facts should stay as questions or placeholders.</p>
          <p className="mt-3">{workflowContext(task)}</p>
          <dl className="mt-3 space-y-2">{includedFields.map(field => <div key={field.key} className="rounded-lg bg-white p-3"><dt className="font-semibold">{field.label}</dt><dd className="whitespace-pre-wrap break-words">{field.value}</dd></div>)}</dl>
          {!includedFields.length && <p className="mt-3">No saved bill details were included. Check the answer against your bill or statement.</p>}
          {draft.brief.trim() && <p className="mt-3 whitespace-pre-wrap break-words"><strong>Your requested outcome: </strong>{draft.brief}</p>}
          {draft.output === "reply" && <details className="mt-3"><summary className="cursor-pointer font-semibold">Original provider message</summary><p className="mt-2 whitespace-pre-wrap break-words">{draft.incoming}</p></details>}
          <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.reviewed} onChange={event => { setDraft(value => ({ ...value, reviewed: event.target.checked })); onDirty(true); }} /><span>I have checked the answer against my bill, corrected any differences and removed unfinished placeholders.</span></label>
          <p className="mt-2 text-sm text-slate-600">Editing the answer resets this check. Nothing is sent automatically. Your saved bill details stay unchanged.</p>
        </fieldset>
        {!draft.reviewed && <p className="text-slate-600">Before saving: read your answer, compare the bill details and tick the check above.</p>}
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={revise}>Revise the request</button><button className={button} disabled={!draft.reviewed || !draft.body.trim() || draft.output !== "plan" && !draft.subject.trim()} onClick={() => void act(async () => { await onSave(draft, selectedService.name); onDirty(false); })}>Save reviewed result</button></div>
      </>}
      <div className="border-t border-slate-200 pt-4"><button className={secondary} onClick={() => void act(saveProgress)}>Save progress for later</button><p className="mt-2 text-slate-600">Use Save progress before leaving unfinished work. Saved progress and results are included in your private bill backup.</p></div>
    </fieldset>
  </section>;
}
