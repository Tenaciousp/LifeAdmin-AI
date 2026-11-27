import { useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "./Feedback";
import ComparisonWorksheet from "./ComparisonWorksheet";
import PlanEmailEditor, { planWithProviderEmail } from "./PlanEmailEditor";
import PlanResultSummary from "./PlanResultSummary";
import { recurringCost } from "./lib/offline/bill-overview.mjs";
import { billCategory } from "./lib/offline/bill-types.mjs";
import { aiServices, aiSelectionGuidance, externalAiResearchGuidance, preferredAi, savePreferredAi } from "./lib/offline/ai-handoff.mjs";
import { goalsFor } from "./lib/offline/bill-types.mjs";
import { initialComparisonEmail, initialWorkflow, languages, localWorkflowDraft, outputs, tones, workflowContext, workflowFields, workflowPrompt } from "./lib/offline/bill-workflow.mjs";
import type { WorkflowDraft } from "./lib/offline/bill-workflow.mjs";
import { copyDeviceText, isNativeDevice, openExternalDeviceUrl } from "./lib/offline/device-files.mjs";
import { copyAndSaveBillHelp } from "./lib/offline/bill-help-handoff.mjs";
import { composeInAppFollowUp, requestInAppFollowUp, retainProviderEmail, runAndClearEphemeralInput } from "./lib/offline/in-app-followup.mjs";
import { comparisonResult } from "./lib/offline/bill-workflow.mjs";
import { aiDraftAvailable, aiDraftConfigured, customerKeyAiAvailable, generateCustomerAi, generateLiveComparison, generateWithGemini, liveComparisonAvailable } from "./lib/offline/ai-generation.mjs";
import LiveComparisonResult, { ComparisonEmailEditor } from "./LiveComparisonResult";
import { sourceLinks } from "./LinkifiedText";
import ExternalLink from "./ExternalLink";

const button = "min-h-[44px] max-w-full rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:opacity-50";
const secondary = "min-h-[44px] max-w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
const input = "mt-1 box-border min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
function preferences() { try { return window.localStorage; } catch { return null; } }
const objectives = [
  { id: "renew", label: "Renew or negotiate a better deal", output: "plan", brief: "Review my renewal, compare equivalent alternatives including staying with my provider, and give me a negotiation plan and a ready-to-edit retention email." },
  { id: "compare", label: "Compare providers and save money", output: "plan", brief: "Compare suitable alternatives, total contract costs, service quality, switching fees and current offers using dated official sources. Include staying with my provider." },
  { id: "understand", label: "Understand my bill or an increase", output: "plan", brief: "Explain my bill and charges in plain language, identify anything unclear, and give me the next steps." },
  { id: "reduce", label: "Reduce costs without switching", output: "plan", brief: "Find suitable ways to reduce my costs with my current provider, including discounts, tariffs, support and package adjustments." },
  { id: "switch", label: "Switch or cancel a service", output: "plan", brief: "Explain switching or cancellation steps, notice requirements, exit charges and continuity risks. Do not assume cancellation is free." },
  { id: "dispute", label: "Query a charge or complain", output: "letter", brief: "Draft a factual complaint or enquiry about a charge, asking for an itemised explanation and fair resolution." },
  { id: "negotiate-letter", label: "Write a price negotiation email", output: "letter", brief: "Write a clear negotiation email requesting a more competitive like-for-like price, itemised charges and contract terms." },
  { id: "request", label: "Ask the provider for help or changes", output: "letter", brief: "Write a polite request about billing, support, payment options or a service change without assuming eligibility." },
  { id: "reply", label: "Reply to a provider message", output: "reply", brief: "Help me respond to my provider's message, clarify unanswered questions and request a practical outcome." },
  { id: "other", label: "Something else", output: "plan", brief: "" },
] as const;


export default function BillHelp({ task, onClose, onEdit, onProgress, onSave, onDirty }: {
  task: any; onClose: () => void; onEdit: (draft: WorkflowDraft) => Promise<void> | void;
  onProgress: (draft: WorkflowDraft) => Promise<void>;
  onSave: (draft: WorkflowDraft, service: string) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<WorkflowDraft>(() => {
    const saved = initialWorkflow(task);
    if (task.workflow_draft) return ["gemini_api", "customer_api"].includes(saved.method) && !aiDraftConfigured()
      ? { ...saved, method: "chosen_ai", step: saved.step === 4 ? 4 : 2 } : saved;
    const goalAction: Record<string, string> = {
      reduce_price: "compare", prepare_renewal: "renew", cancel_switch: "switch", check_bill: "compare",
      challenge_charge: "dispute", identify_payment: "understand", contact_provider: "request",
      water_meter: "understand", water_usage: "understand", water_support: "request",
    };
    const action = objectives.find(item => item.id === (goalAction[task.goal_id] || "compare")) || objectives[1];
    return { ...saved, step: 2, output: action.output, brief: action.brief, liveComparison: action.id === "compare" };
  });
  const [service, setService] = useState(() => preferredAi(preferences()));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [geminiConsent, setGeminiConsent] = useState(false);
  const [customerConsent, setCustomerConsent] = useState(false);
  const [customerProvider, setCustomerProvider] = useState(draft.aiProvider || "gemini");
  const [customerApiKey, setCustomerApiKey] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [generationAvailable, setGenerationAvailable] = useState(false);
  const [liveComparisonReady, setLiveComparisonReady] = useState(false);
  const [customerKeyAvailable, setCustomerKeyAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([aiDraftAvailable(), liveComparisonAvailable(), customerKeyAiAvailable()]).then(([drafting, comparisons, customerKey]) => {
      if (active) {
        setGenerationAvailable(drafting); setLiveComparisonReady(comparisons); setCustomerKeyAvailable(customerKey);
        if (!customerKey) setDraft(value => value.method === "customer_api" && value.step !== 4 ? { ...value, method: "chosen_ai", step: 2 } : value);
      }
    });
    return () => { active = false; };
  }, []);

  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const fields = workflowFields(task);
  const includedFields = fields.filter(field => draft.method === "local" || draft.fieldKeys.includes(field.key));
  const selectedService = aiServices.find(item => item.id === service)!;
  let followUpPromptPreview = "";
  let followUpPromptIssue = "";
  if (followUpQuestion.trim() && draft.body.trim() && ["gemini_api", "customer_api"].includes(draft.method)) {
    try {
      followUpPromptPreview = composeInAppFollowUp({
        originalRequest: workflowPrompt(task, { ...draft, step: 3 }),
        currentAnswer: draft.body,
        followUpQuestion,
      });
    } catch (failure) {
      followUpPromptIssue = failure instanceof Error ? failure.message : "Shorten the follow-up before sending.";
    }
  }
  const liveGroundedComparison = ["gemini_api", "customer_api"].includes(draft.method) && draft.liveComparison && Boolean(draft.grounding);
  const savedGoal = goalsFor(billCategory(task)).find(item => item.id === task.goal_id)?.label || "Check this bill";
  const selectedObjective = objectives.find(item => item.output === draft.output && item.brief === draft.brief)?.label || "Your custom request";
  // Keep the product's five-stage household loop visible while the existing
  // form steps remain grouped inside the relevant stage.
  const visibleStage = draft.step <= 2 ? 2 : draft.step === 3 ? 3 : 4;
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [draft.step]);
  function change(patch: Partial<WorkflowDraft>) { setDraft(value => ({ ...value, ...patch, reviewed: false })); if (patch.method && patch.method !== "customer_api" || patch.step === 2 || patch.step === 4) setCustomerApiKey(""); setGeminiConsent(false); setCustomerConsent(false); setStatus(""); setError(""); onDirty(true); }
  async function act(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setWorking(true); setError(""); setStatus("");
    try { await operation(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to complete this step. Your entered text is still here."); }
    finally { pending.current = false; setWorking(false); }
  }
  async function saveProgress() { await onProgress(draft); setCustomerApiKey(""); onDirty(false); setStatus("Progress saved on this device. Resume from this bill after reopening HomeAdmin."); }
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
  async function pasteAiAnswer() {
    await act(async () => {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard access is unavailable here. Tap the answer box and choose Paste instead.");
      let copiedText = "";
      try { copiedText = await navigator.clipboard.readText(); }
      catch { throw new Error("HomeAdmin could not read the clipboard. Tap the answer box and choose Paste instead."); }
      const answer = copiedText.trim();
      if (!answer) throw new Error("Your clipboard is empty. Copy the answer from your AI, then try again.");
      if (answer.length > 20000) throw new Error("This answer is too long to save here. Shorten it in your AI, then try again.");

      if (draft.output !== "plan") {
        const subject = answer.match(/^\s*Subject:\s*(.{1,200}?)(?:\r?\n|$)/i);
        const message = subject ? answer.replace(subject[0], "").replace(/^\s*Message:\s*/i, "").trim() : answer;
        change({ body: message, ...(subject ? { subject: subject[1].trim() } : {}) });
        setStatus(subject ? "Answer pasted. Check the subject and message before saving." : "Answer pasted. Add its subject, then check the message before saving.");
      } else {
        change({ body: answer });
        setStatus("Answer pasted. Check the plan and any prices against the provider sources before saving.");
      }
    });
  }
  async function copyAndSaveQuestion() {
    await act(async () => {
      try {
        const result = await copyAndSaveBillHelp({
          copyPrompt: () => copyDeviceText(prompt),
          saveProgress: () => onProgress(draft),
        });
        onDirty(false);
        setStatus(result.copied
          ? "Question copied and progress saved. Open your chosen AI below, paste the question, then return here."
          : "Progress saved, but copying failed. Select the visible question and copy it manually, then open your chosen AI below.");
      } catch (failure) {
        onDirty(true);
        setStatus(failure instanceof Error
          ? `${failure.message} Progress was not confirmed as saved. The question remains visible; use the separate Open ${selectedService.name} link if you wish.`
          : `Progress was not confirmed as saved. The question remains visible; use the separate Open ${selectedService.name} link if you wish.`);
      }
    });
  }
  async function submitInAppFollowUp() {
    if (!followUpPromptPreview) throw new Error(followUpPromptIssue || "Enter a follow-up and review the request before sending.");
    const followUpPrompt = followUpPromptPreview;
    const liveFollowUp = draft.liveComparison && draft.output === "plan";
    const result = await runAndClearEphemeralInput(() => requestInAppFollowUp({
      prompt: followUpPrompt,
      output: draft.output,
      method: draft.method as "gemini_api" | "customer_api",
      provider: customerProvider,
      apiKey: customerApiKey,
      liveComparison: liveFollowUp,
      generateDraft: generateWithGemini,
      generateComparison: generateLiveComparison,
      generateCustomer: generateCustomerAi,
    }), () => {
      setCustomerApiKey("");
      setFollowUpConsent(false);
    });
    if (liveFollowUp) {
      const separated = comparisonResult(task, result.body, draft.messageSubject, draft.messageBody);
      change({ ...result, ...separated, ...retainProviderEmail(draft, separated), aiProvider: draft.method === "customer_api" ? customerProvider : "gemini", step: 4, reviewed: false });
      setStatus("Live comparison and sources refreshed. Your edited provider email was kept. Review the new evidence before saving.");
    } else {
      change({ ...result, aiProvider: draft.method === "customer_api" ? customerProvider : "gemini", step: 4, reviewed: false });
      setStatus("Follow-up answered in HomeAdmin. Review the revised result and check its details before saving.");
    }
    setFollowUpQuestion("");
    setFollowUpConsent(false);
  }
  async function generateWithCustomerKey() {
    const result = await runAndClearEphemeralInput(
      () => generateCustomerAi(prompt, draft.output, customerProvider, customerApiKey, draft.liveComparison && draft.output === "plan"),
      () => { setCustomerApiKey(""); setCustomerConsent(false); },
    );
    if (draft.liveComparison && draft.output === "plan") {
      const separated = comparisonResult(task, result.body, draft.messageSubject, draft.messageBody);
      change({ ...result, ...separated, aiProvider: customerProvider, step: 4, reviewed: false });
      setStatus("The provider returned a sourced comparison. Review every source and your separate provider email before saving.");
      return;
    }
    let answer = result.body;
    if (draft.output !== "plan") {
      const subject = answer.match(/^\s*Subject:\s*(.{1,200}?)(?:\r?\n|$)/i);
      if (subject) answer = answer.replace(subject[0], "").replace(/^\s*Message:\s*/i, "").trim();
      change({ aiProvider: customerProvider, body: answer, ...(subject ? { subject: subject[1].trim() } : {}), step: 4, reviewed: false });
    } else change({ ...result, aiProvider: customerProvider, step: 4, reviewed: false });
    setStatus("AI answer received. Review every fact and edit the result before saving.");
  }
  let prompt = "";
  if (draft.step === 3) { try { prompt = workflowPrompt(task, draft); } catch { /* The next-step action displays the actionable validation message. */ } }
  return <section id="bill-help" aria-labelledby="bill-help-heading" className="rounded-2xl border-2 border-violet-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 ref={heading} id="bill-help-heading" tabIndex={-1} className="text-2xl font-bold focus-visible:outline focus-visible:outline-violet-700">Help with {task.title}</h2><p className="mt-2 text-slate-600">You are in the right place. Choose what you want to happen with this bill. HomeAdmin explains each step, including how to use your chosen AI. Nothing is sent automatically.</p></div><button className={secondary} disabled={working} onClick={() => { setCustomerApiKey(""); setCustomerConsent(false); onClose(); }}>Close bill help</button></div>
    <p className="mt-4 font-semibold text-violet-900">Step {visibleStage} of 4</p><p role="status" className="mt-2 rounded-xl bg-violet-50 p-3 text-slate-800">{draft.step === 1 ? "Choose what to do with this bill. Your saved details stay in place." : draft.step === 2 ? "Check the bill details HomeAdmin will use. You can correct them before continuing." : draft.step === 3 ? draft.method === "chosen_ai" ? "Your comparison question is ready. Use your chosen AI, then bring its answer back to review." : ["gemini_api", "customer_api"].includes(draft.method) ? "Review the request and sharing details before asking for an answer." : "Review the offline template; no AI account is needed." : "Choose a suitable offer using its provider link, or send your reviewed negotiation message to your current provider."}</p>
    <ol aria-label="Bill review and action" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">{["Add bill", "Check details", "Choose an option", "Contact provider"].map((label, i) => <li key={label} aria-current={visibleStage === i + 1 ? "step" : undefined} className={"rounded-xl p-3 font-semibold " + (visibleStage === i + 1 ? "bg-violet-100 text-violet-950" : i < visibleStage - 1 ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-600")}>{`${i + 1}. ${label}`}</li>)}</ol>
    {working && <p role="status" aria-busy="true" className="mt-4 flex items-center gap-2 rounded-xl bg-violet-50 p-4 font-semibold text-violet-900"><LoadingSpinner />Working on your draft…</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}{status && <p role="status" className="mt-4 rounded-xl bg-teal-50 p-4 text-teal-950">{status}</p>}
    <fieldset disabled={working} className="mt-5 min-w-0 space-y-4 border-0 p-0" aria-busy={working}>
      {draft.step === 1 && <>
        <fieldset className="min-w-0"><legend className="text-xl font-bold">What do you want to achieve?</legend><p className="mt-2 text-slate-600">Choose the option closest to your problem. For example, Save money asks about alternative deals; Query a charge prepares a complaint; Write an email helps you contact your provider. There is no wrong starting point: you can change your choice.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{objectives.filter(item => ["compare", "dispute", "negotiate-letter"].includes(item.id)).map(item => <button key={item.id} type="button" aria-pressed={draft.output === item.output && draft.brief === item.brief} className={`min-h-[44px] rounded-xl border p-3 text-left font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700 ${draft.output === item.output && draft.brief === item.brief ? "border-violet-700 bg-violet-100 text-violet-950 ring-2 ring-violet-600" : "border-violet-200 bg-violet-50 text-violet-950 hover:bg-violet-100"}`} onClick={() => { const email = item.id === "compare" ? initialComparisonEmail(task) : { subject: "", body: "" }; change({ output: item.output, brief: item.brief, subject: "", body: "", liveComparison: item.id === "compare", grounding: null, messageSubject: email.subject, messageBody: email.body, incoming: item.output === "reply" ? draft.incoming : "" }); }}>{item.label}</button>)}</div><details className="mt-3 rounded-xl border border-slate-200 p-3"><summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-slate-800">More ways to get help</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{objectives.filter(item => !["compare", "dispute", "negotiate-letter"].includes(item.id)).map(item => <button key={item.id} type="button" aria-pressed={draft.output === item.output && draft.brief === item.brief} className={`min-h-[44px] rounded-xl border p-3 text-left font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700 ${draft.output === item.output && draft.brief === item.brief ? "border-violet-700 bg-violet-100 text-violet-950 ring-2 ring-violet-600" : "border-violet-200 bg-violet-50 text-violet-950 hover:bg-violet-100"}`} onClick={() => change({ output: item.output, brief: item.brief, subject: "", body: "", liveComparison: false, grounding: null, messageSubject: "", messageBody: "", incoming: item.output === "reply" ? draft.incoming : "" })}>{item.label}</button>)}</div></details></fieldset>
        {objectives.some(item => item.output === draft.output && item.brief === draft.brief) && <p role="status" className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-950"><strong>Selected:</strong> {objectives.find(item => item.output === draft.output && item.brief === draft.brief)?.label}. Next, check your bill details and review the request before asking your chosen AI.</p>}
        <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">Change the type of result (optional)</summary><fieldset className="mt-3 min-w-0"><legend className="font-bold">Plan, letter or reply</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{outputs.map(output => <label key={output.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-4 " + (draft.output === output.id ? "border-violet-700 bg-violet-50" : "border-slate-200")}><input type="radio" name="bill-help-output" className="mt-1 h-5 w-5 shrink-0" checked={draft.output === output.id} onChange={() => change({ output: output.id, body: "", subject: "", liveComparison: false, grounding: null, messageSubject: "", messageBody: "" })} /><span><strong className="block">{output.label}</strong><span className="mt-1 block">{output.description}</span></span></label>)}</div></fieldset></details>
        <fieldset className="min-w-0"><legend className="text-xl font-bold">How would you like to get your answer?</legend><p className="mt-2 text-slate-700">Choose what suits you. If you already use Copilot, Gemini or another AI, keep your usual service. If direct AI is available inside HomeAdmin, you can choose that instead.</p>
          {(generationAvailable || (liveComparisonReady && draft.output === "plan")) && <label className="mt-3 flex min-h-[44px] items-start gap-3 rounded-xl border border-violet-300 bg-violet-50 p-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "gemini_api"} onChange={() => change({ method: "gemini_api" })} /><span><strong className="block">Get an AI answer directly in HomeAdmin</strong><span className="block text-sm">No copying or switching apps. For a provider comparison, select live research below and review the sources before deciding.</span></span></label>}
          {customerKeyAvailable && <label className="mt-3 flex min-h-[44px] items-start gap-3 rounded-xl border border-teal-300 bg-teal-50 p-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "customer_api"} onChange={() => change({ method: "customer_api", liveComparison: draft.output === "plan" && draft.liveComparison })} /><span><strong className="block">Use my provider API key for a live answer</strong><span className="block text-sm">Choose OpenAI, Gemini or Claude. Your key is requested for this answer only and is not saved by HomeAdmin. API usage fees apply through your provider account.</span></span></label>}
          <label className="mt-3 flex min-h-[44px] items-center gap-3"><input type="radio" name="bill-help-method" className="h-5 w-5 shrink-0" checked={draft.method === "chosen_ai"} onChange={() => change({ method: "chosen_ai" })} /><span><strong className="block">Use Copilot or my preferred AI</strong><span className="block text-sm text-slate-600">HomeAdmin prepares the question. You copy it into your AI and bring the answer back to review.</span></span></label>
        {draft.method === "customer_api" && !customerKeyAvailable && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">This route is currently unavailable. Choose Copilot handoff or an offline draft.</p>}
        {draft.method === "chosen_ai" && <div className="mt-3"><label htmlFor="preferred-ai-service" className="font-semibold">AI service to use</label><select id="preferred-ai-service" aria-describedby="preferred-ai-guidance" className={input} value={service} onChange={event => { setService(event.target.value); try { savePreferredAi(preferences(), event.target.value); } catch (failure) { setError(failure instanceof Error ? failure.message : "AI preference was not saved."); } }}>{aiServices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p id="preferred-ai-guidance" className="mt-2 text-slate-600">{aiSelectionGuidance}</p></div>}
          <details className="mt-4 rounded-xl border border-slate-200 p-3" open={draft.method !== "chosen_ai" ? true : undefined}><summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Other ways to prepare a draft</summary>

            <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="radio" name="bill-help-method" className="mt-1 h-5 w-5 shrink-0" checked={draft.method === "local"} onChange={() => change({ method: "local" })} /><span><strong className="block">Start from an offline draft</strong>A template for you to personalise.</span></label>
          </details>
        </fieldset>
        <p className="text-slate-600">{draft.method === "chosen_ai" ? "Next: check your bill details, copy the request into your AI, then bring the answer back to review and save." : "Next: check your bill details and prepare a draft for review."}</p>
        <button className={button} onClick={() => change({ step: 2 })}>Continue to details</button>
      </>}
      {draft.step === 2 && <>
        <h3 className="text-xl font-bold">Check your bill details</h3><p className="mt-2 text-slate-700">We carried your saved bill details into this request. Check the details below, then prepare your question. If you correct the bill, HomeAdmin saves your place and returns here.</p><p className="rounded-xl bg-violet-50 p-3">{workflowContext(task)} <strong>AI action: {selectedObjective}.</strong><span className="block mt-1 text-sm">Original bill goal: {savedGoal}.</span></p><button className={secondary} onClick={() => change({ step: 1 })}>Change AI action</button> <button className={secondary} onClick={() => void onEdit(draft)}>Edit bill details and return here</button>
        <label className="block font-semibold">Your request to the AI<textarea aria-label="Your request to the AI" className={input + " font-normal"} rows={3} maxLength={2000} value={draft.brief} placeholder={draft.output === "reply" ? "e.g. Explain why the reply has not resolved my meter-reading query" : "e.g. Explain the price rise and request an itemised bill"} onChange={event => change({ brief: event.target.value })} /></label>
        <p>Include key dates and the specific question. Avoid passwords, security codes, full payment-card numbers and unnecessary personal information.</p>
        {draft.output === "reply" && <label className="block font-semibold">Provider message to respond to<textarea className={input + " font-normal"} rows={6} maxLength={10000} aria-invalid={draft.output === "reply" && error.includes("Paste the provider message")} aria-describedby={draft.output === "reply" && error.includes("Paste the provider message") ? "incoming-error" : undefined} value={draft.incoming} placeholder="Paste the relevant message. Remove signatures, addresses, account numbers and unrelated conversation first." onChange={event => change({ incoming: event.target.value })} />{draft.output === "reply" && error.includes("Paste the provider message") && <span id="incoming-error" role="alert" className="mt-1 block text-sm font-semibold text-red-800">A provider message is required for a reply.</span>}<span className="mt-2 block font-normal">For the AI route, this text and your requested outcome appear in the request you review before copying. The offline reply is a starting template, not an analysis of the message.</span></label>}
        {draft.method !== "local" && <>
          <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Language and writing style</summary><div className="mt-3 grid gap-4 sm:grid-cols-2"><label>Response tone<select className={input} value={draft.tone} onChange={event => change({ tone: event.target.value })}>{tones.map(tone => <option key={tone}>{tone}</option>)}</select></label><label>Response language<select className={input} value={draft.language} onChange={event => change({ language: event.target.value })}>{languages.map(language => <option key={language}>{language}</option>)}</select></label></div></details>
          <details className="rounded-xl border border-slate-200 p-3"><summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Choose which bill details to share (optional)</summary><p className="mt-2">Checked details go into the AI request. Untick anything you want to leave out. Edit the bill above to correct a value.</p>{fields.length ? fields.map(field => <label key={field.key} className="mt-2 flex min-h-[44px] items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.fieldKeys.includes(field.key)} onChange={event => change({ fieldKeys: event.target.checked ? [...draft.fieldKeys, field.key] : draft.fieldKeys.filter(key => key !== field.key) })} /><span className="min-w-0"><strong>{field.label}</strong><span className="block whitespace-pre-wrap">{field.value}</span></span></label>) : <p className="mt-2">No bill details supplied yet. Edit the bill or describe the key facts in your outcome.</p>}</details>
        </>}
        {draft.method === "local" && <p>Offline drafts use the saved bill details and English templates. Read every section and replace placeholders. No information is shared with an AI service.</p>}
        {draft.method === "chosen_ai" && <label className="block font-semibold">AI service<select className={input} value={service} onChange={event => { setService(event.target.value); try { savePreferredAi(preferences(), event.target.value); } catch (failure) { setError(failure instanceof Error ? failure.message : "AI preference was not saved."); } }}>{aiServices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-1 block font-normal text-slate-600">Your choice is remembered on this device. No bill details go to the AI until you copy and send the question.</span></label>}
        <div className="flex flex-wrap gap-3"><button className={button} onClick={prepare}>{draft.method === "local" ? "Prepare offline draft" : draft.method === "gemini_api" ? "Get AI answer" : draft.liveComparison ? "Prepare comparison question" : "Prepare AI question"}</button></div>
      </>}
      {draft.step === 3 && draft.method === "chosen_ai" && <>
        <h3 className="text-xl font-bold">Your AI question is ready</h3><p className="mt-2 text-slate-700">{externalAiResearchGuidance(selectedService.name)}</p>
        <ol className="list-decimal space-y-2 pl-6"><li>Check the request below, then copy the question and open your chosen AI separately.</li><li>Paste the copied question into your AI and send.</li><li>Copy the answer, return to HomeAdmin and press <strong>I have an answer to review</strong>.</li></ol>
        <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">How do I paste the question and return?</summary><ol className="mt-3 list-decimal space-y-2 pl-6"><li>Press Copy question. The question is copied and your progress is saved.</li><li>In {selectedService.name}, tap the message box, choose Paste, then send the question. Sign in if asked.</li><li>Copy the AI answer, return to HomeAdmin, and press I have an answer to review.</li><li>Paste the answer, check its prices and links, then open an offer or edit and send your provider message.</li></ol><p className="mt-3">Then press Open {selectedService.name} below. If copying failed, select the visible question and copy manually.</p></details>
        <p className="text-slate-600">Copying saves your progress. Your AI receives the request when you paste and send. Answers return through copy and paste.</p>
        {draft.output === "plan" && <section aria-label="What a useful savings plan should include" className="rounded-xl border border-violet-200 bg-violet-50 p-4"><h4 className="font-bold text-violet-950">Check the AI answer before you save it</h4><p className="mt-2 text-violet-950">Look for your current cost, equivalent alternatives, total cost including fees, a realistic next step and a ready-to-edit provider message. Only treat prices as current when the answer supplies official sources and dates. If an offer is unverified, ask the provider to confirm it.</p></section>}

        <label className="block">Prepared AI request<textarea aria-label="Prepared AI request" className={input} readOnly rows={10} value={prompt} /></label>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={!prompt} onClick={() => void copyAndSaveQuestion()}>Copy question</button><ExternalLink className={secondary + " inline-flex items-center"} href={selectedService.url}>Open {selectedService.name}</ExternalLink><button className={secondary} onClick={() => change({ step: 2 })}>Change details</button></div>
        <button className={button} onClick={() => change({ step: 4 })}>I have an answer to review</button>
      </>}
      {draft.step === 3 && draft.method === "customer_api" && <>
        <h3 className="text-xl font-bold">Get a live answer from your AI provider</h3>
        <p className="mt-2">HomeAdmin sends the reviewed request and your key through its HTTPS relay to the provider you select. The key stays in this screen's temporary memory and is not saved by HomeAdmin. Your provider handles and bills the API request under your account and data terms. Your consumer subscription does not count as API credit. HomeAdmin does not cap provider charges, so check your provider's API prices and usage controls first.</p>
        <label className="block font-semibold">Provider<select className={input} value={customerProvider} onChange={event => { setCustomerProvider(event.target.value); setCustomerApiKey(""); setCustomerConsent(false); }}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic Claude</option></select></label>
        <label className="block font-semibold">Provider API key<input type="password" className={input} value={customerApiKey} onChange={event => setCustomerApiKey(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={512} /></label>
        {draft.output === "plan" && <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-violet-300 bg-violet-50 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.liveComparison} onChange={event => { const enabled = event.target.checked; const email = enabled ? initialComparisonEmail(task) : { subject: "", body: "" }; change({ liveComparison: enabled, grounding: null, body: "", messageSubject: email.subject, messageBody: email.body }); }} /><span><strong className="block">Search current offers and return source links</strong><span className="block text-sm">The provider must return dated, linked web evidence before HomeAdmin saves a comparison.</span></span></label>}
        <label className="block">Reviewed request<textarea className={input} readOnly rows={8} value={prompt} /></label>
        <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={customerConsent} onChange={event => setCustomerConsent(event.target.checked)} /><span>I reviewed the request and removed details I do not want to share. I agree to send the request and API key through HomeAdmin's relay to the selected provider for this answer. Provider API fees and data terms apply. HomeAdmin does not save my key.</span></label>
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => change({ method: "chosen_ai", step: 3 })}>Use Copilot handoff</button><button className={secondary} onClick={() => change({ method: "local", step: 2, liveComparison: false, grounding: null })}>Use offline draft</button><button className={button} disabled={!customerKeyAvailable || customerApiKey.length < 10 || !customerConsent || !prompt || working} onClick={() => void act(generateWithCustomerKey)}>{working ? <span className="inline-flex items-center gap-2"><LoadingSpinner />Getting your answer…</span> : draft.liveComparison ? "Search and compare current offers" : "Get answer from provider"}</button></div>
        <div className="flex flex-wrap gap-4"><ExternalLink className="inline-flex min-h-[44px] items-center font-semibold text-violet-800 underline" href={customerProvider === "openai" ? "https://platform.openai.com/api-keys" : customerProvider === "anthropic" ? "https://console.anthropic.com/settings/keys" : "https://aistudio.google.com/app/apikey"}>Manage {customerProvider === "openai" ? "OpenAI" : customerProvider === "anthropic" ? "Anthropic" : "Google"} API keys</ExternalLink><ExternalLink className="inline-flex min-h-[44px] items-center font-semibold text-violet-800 underline" href={customerProvider === "openai" ? "https://openai.com/api/pricing/" : customerProvider === "anthropic" ? "https://www.anthropic.com/pricing#api" : "https://ai.google.dev/gemini-api/docs/pricing"}>Check API prices</ExternalLink></div>
      </>}
      {draft.step === 3 && draft.method === "gemini_api" && <>
        <h3 className="text-xl font-bold">{draft.liveComparison ? "Compare current alternatives inside HomeAdmin" : "Get your AI answer inside HomeAdmin"}</h3>
        {draft.output === "plan" && <label className="mt-3 flex min-h-[44px] items-start gap-3 rounded-xl border border-violet-300 bg-violet-50 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.liveComparison} onChange={event => { const enabled = event.target.checked; const email = enabled ? initialComparisonEmail(task) : { subject: "", body: "" }; change({ liveComparison: enabled, grounding: null, body: "", messageSubject: email.subject, messageBody: email.body }); }} /><span><strong className="block">Search current alternatives using Google Search</strong><span className="block text-sm">This is the main comparison route. HomeAdmin returns current web sources, related Google searches and a separate editable provider email.</span></span></label>}
        {draft.liveComparison ? <p className="mt-3">The reviewed request and selected bill details go to HomeAdmin's server and Google Gemini with Google Search only after you approve below. Google retains the prompt, context and result for up to 30 days. HomeAdmin does not keep a server copy of the request or result. The result returns here with Google Search suggestions for your review. No AI account is needed; access depends on the HomeAdmin service and its usage limit.</p> : <p>The checked bill details, your requested outcome and any provider message shown below will be sent to HomeAdmin's AI service and then Google Gemini only after you press Generate draft. HomeAdmin does not keep a server copy of the request or answer. Google processes them under its API terms. The answer returns here for your review.</p>}
        {draft.liveComparison ? !liveComparisonReady && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-950">Live research is not enabled for this version. Use your preferred AI or an offline draft. No live prices will be shown as checked.</p> : !generationAvailable && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-950">In-app drafting is unavailable or still being checked. Use your chosen AI service or an offline draft.</p>}
        <div className="flex flex-wrap gap-3" aria-label="Other ways to finish this draft"><button className={secondary} onClick={() => change({ method: "chosen_ai", step: 3 })}>Use my chosen AI instead</button><button className={secondary} onClick={() => change({ method: "local", step: 2, liveComparison: false, grounding: null })}>Use an offline draft instead</button></div>
        <label className="block">Reviewed request<textarea className={input} readOnly rows={10} value={prompt} /></label>
        <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={geminiConsent} onChange={event => setGeminiConsent(event.target.checked)} /><span>{draft.liveComparison ? "I agree to send the request and selected bill details through HomeAdmin's server to Google Gemini with Google Search. I reviewed the privacy notice, understand Google Search grounding retains the prompt, context and result for up to 30 days, and removed details I do not want to share." : "I agree to send the request above through HomeAdmin's server to Google Gemini. I reviewed the app privacy notice and removed details I do not want to share. HomeAdmin applies usage limits."}</span></label>
        <a className="inline-flex min-h-[44px] items-center font-semibold text-violet-800 underline underline-offset-2" href="https://tenaciouspl.co.uk/app-privacy.html" target="_blank" rel="noopener noreferrer">How in-app AI handles your request</a>
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => change({ step: 2 })}>Change request details</button><button className={button} disabled={!(draft.liveComparison ? liveComparisonReady : generationAvailable) || !geminiConsent || !prompt || working} onClick={() => void act(async () => { if (draft.liveComparison) { const result = await generateLiveComparison(prompt); const separated = comparisonResult(task, result.body, draft.messageSubject, draft.messageBody); change({ ...result, ...separated, step: 4, reviewed: false }); setStatus("Current alternatives were researched. Review the result, its sources and your separate email before saving."); } else { const result = await generateWithGemini(prompt, draft.output); change({ ...result, step: 4, reviewed: false }); setStatus("Draft generated. Review every fact and edit the wording before saving."); } })}>{working ? <span className="inline-flex items-center gap-2"><LoadingSpinner />{draft.liveComparison ? "Searching current offers…" : "Generating draft…"}</span> : draft.liveComparison ? "Search current alternatives" : "Generate draft with Gemini"}</button></div>
      </>}
      {draft.step === 4 && <>
        <h3 className="text-xl font-bold">{draft.method === "local" ? "Personalise your offline draft" : liveGroundedComparison ? "Review live comparison and message" : draft.method === "gemini_api" ? "Review your Gemini draft" : draft.method === "customer_api" ? "Review your provider's answer" : "Paste and review your AI answer"}</h3><p>{draft.method === "local" ? "This is a local template, not an AI-generated response." : liveGroundedComparison ? `${draft.grounding?.provider || "The selected AI provider"} returned this comparison with web sources. Review the dated sources and terms; HomeAdmin has not independently confirmed prices or eligibility.` : draft.method === "gemini_api" ? "Generated by Google Gemini from the request you approved. HomeAdmin has not independently verified the answer." : draft.method === "customer_api" ? "Generated by the provider you selected using your API account. HomeAdmin has not independently verified the answer." : "Paste the answer from your chosen AI. HomeAdmin does not fetch or verify the answer automatically."} Saving keeps a separate result linked to this bill, without replacing earlier plans.</p>
        <p className="rounded-xl bg-teal-50 p-3">{draft.output === "plan" ? "Paste the complete answer from your AI below. The answer stays in this bill draft on your device. Check provider offers on their official websites before relying on prices or savings." : "Paste the complete answer from your AI below. The answer stays in this bill draft on your device. HomeAdmin separates a starting “Subject:” line when present. Check the subject and message before sending."}</p>
        {draft.output === "plan" && liveGroundedComparison && draft.body.trim() && <LiveComparisonResult body={draft.body} grounding={draft.grounding!} />}
        {draft.output === "plan" && liveGroundedComparison && <ComparisonEmailEditor subject={draft.messageSubject} body={draft.messageBody} onSubjectChange={value => change({ messageSubject: value })} onBodyChange={value => change({ messageBody: value })} />}
        {draft.output === "plan" && !liveGroundedComparison && draft.body.trim() && <PlanResultSummary plan={draft.body} savedCost={recurringCost(task)} />}
        {draft.output === "plan" && !liveGroundedComparison && draft.body.trim() && <PlanEmailEditor plan={draft.body} provider={String(task.details?.provider || task.title || "")} onChange={body => change({ body })} onStatus={setStatus} onError={setError} />}
        {["gemini_api", "customer_api"].includes(draft.method) && draft.body.trim() && <section className="rounded-xl border border-violet-200 bg-violet-50 p-4" aria-labelledby="in-app-follow-up-heading">
          <h4 id="in-app-follow-up-heading" className="font-bold">Ask a follow-up in HomeAdmin</h4>
          <p className="mt-2">HomeAdmin sends the original request with bill details, the current answer and your new question. Review the exact request below. For a live comparison, the AI searches again and refreshes its sources; your separate provider email stays as edited.</p>
          <label className="mt-3 block font-semibold">What would you like to clarify or change?<textarea className={input} rows={3} maxLength={4000} value={followUpQuestion} onChange={event => { setFollowUpQuestion(event.target.value); setFollowUpConsent(false); }} /></label>
          {(followUpPromptPreview || followUpPromptIssue) && <details className="mt-3 rounded-xl border border-slate-300 bg-white p-3" open><summary className="cursor-pointer font-semibold">Review the exact AI request</summary>{followUpPromptPreview ? <textarea className={input + " font-normal"} aria-label="Exact AI follow-up request" rows={8} readOnly value={followUpPromptPreview} /> : <p role="alert" className="mt-2 text-sm text-amber-900">{followUpPromptIssue}</p>}</details>}
          <label className="mt-3 flex min-h-[44px] items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={followUpConsent} onChange={event => setFollowUpConsent(event.target.checked)} /><span>{draft.method === "customer_api" ? `I reviewed the request and approve sending it with my ${customerProvider} API key through HomeAdmin's relay to ${customerProvider}. API charges and provider data terms apply.` : draft.liveComparison ? "I reviewed the request and approve sending it through HomeAdmin to Google Gemini with Google Search. Google retains the prompt, context and result for up to 30 days." : "I reviewed the request and approve sending it through HomeAdmin to Google Gemini. Provider data terms apply."}</span></label>
          {draft.method === "customer_api" && <label className="mt-3 block font-semibold">Enter your API key again for this follow-up<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={512} className={input} value={customerApiKey} onChange={event => { setCustomerApiKey(event.target.value); setFollowUpConsent(false); }} /></label>}
          <button type="button" className={button + " mt-3"} disabled={!(draft.method === "customer_api" ? customerKeyAvailable && customerApiKey.length >= 10 : draft.liveComparison ? liveComparisonReady : generationAvailable) || !followUpPromptPreview || !followUpConsent || working} onClick={() => void act(submitInAppFollowUp)}>{working ? "Updating answer…" : draft.liveComparison ? "Research this follow-up" : "Ask follow-up"}</button>
          {draft.method === "gemini_api" && !(draft.liveComparison ? liveComparisonReady : generationAvailable) && <p role="status" className="mt-2 text-sm">{draft.liveComparison ? "Live source research is unavailable in this offline build. Your current comparison and email remain unchanged." : "In-app AI is unavailable in this offline build. Your current answer remains editable."}</p>}
        </section>}
        {draft.output !== "plan" && <label className="block">Result subject<input aria-label="Result subject" className={input} maxLength={200} aria-invalid={!draft.subject.trim()} value={draft.subject} onChange={event => change({ subject: event.target.value })} />{!draft.subject.trim() && <span className="mt-1 block text-sm text-amber-900">Add a subject before saving.</span>}</label>}
        <div className="block">
          <label htmlFor="ai-answer-text" className="font-semibold">{draft.output === "plan" ? "Answer from your AI" : "Message text"}</label>
          {draft.method === "chosen_ai" && !liveGroundedComparison && <button type="button" className={button + " mb-2 mt-2 block"} onClick={() => void pasteAiAnswer()}>Paste answer from clipboard</button>}
          <textarea id="ai-answer-text" aria-label={draft.output === "plan" ? "Answer from your AI" : "Message text"} className={input} rows={12} maxLength={20000} readOnly={liveGroundedComparison} aria-invalid={!draft.body.trim()} placeholder={draft.method === "chosen_ai" && !draft.body.trim() ? draft.output === "plan" ? "Tap here and choose Paste, or use Paste answer from clipboard." : "Paste the message body here. Add Subject: on the first line to fill the subject too." : undefined} value={draft.body} onChange={event => { if (!liveGroundedComparison) change({ body: event.target.value }); }} />
          {!liveGroundedComparison && sourceLinks(draft.body).length > 0 && <section aria-label="Open links from the AI answer" className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-4"><h4 className="font-bold text-teal-950">Open offer and provider links</h4><p className="mt-1 text-sm text-slate-700">Check the price, eligibility and full terms on the provider website before choosing an offer.</p><ul className="mt-2 space-y-2">{sourceLinks(draft.body).map(url => <li key={url}><ExternalLink className="break-all font-semibold text-violet-800 underline underline-offset-2" href={url}>{url}</ExternalLink></li>)}</ul></section>}
          {!draft.body.trim() && <span className="mt-1 block text-sm text-amber-900">Add a {draft.output === "plan" ? "plan" : "message"} before saving.</span>}
          {liveGroundedComparison && <span className="mt-1 block text-sm text-slate-600">The web-grounded comparison stays unchanged. Edit your separate provider email below.</span>}
        </div>
        {draft.output === "plan" && !draft.liveComparison && !["water", "council_tax_licences"].includes(billCategory(task)) && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-violet-950">Add a provider offer I have checked (optional)</summary><p className="mt-3 text-sm text-slate-700">Your AI summary and editable provider email are available above without filling in another form. Open this worksheet only if you want to compare prices from a provider source you have checked yourself. AI-suggested prices are not independently verified by HomeAdmin.</p><ComparisonWorksheet provider={String(task.details?.provider || task.title || "")} currency={String(task.details?.currency || "GBP")} currentMonthly={recurringCost(task)?.monthly ?? null} onApply={summary => change({ body: [draft.body.trim(), summary].filter(Boolean).join("\n\n") })} /></details>}
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
        <div className="flex flex-wrap gap-3"><button className={secondary} onClick={revise}>Revise the request</button><button className={button} disabled={!draft.reviewed || !draft.body.trim() || draft.output !== "plan" && !draft.subject.trim() || liveGroundedComparison && (!draft.messageSubject.trim() || !draft.messageBody.trim())} onClick={() => void act(async () => { await onSave(draft.output === "plan" && !liveGroundedComparison ? { ...draft, body: planWithProviderEmail(draft.body, String(task.details?.provider || task.title || "")) } : draft, draft.method === "gemini_api" ? draft.liveComparison ? "Google Gemini with Google Search" : "Google Gemini API" : draft.method === "customer_api" ? `${customerProvider} API` : selectedService.name); onDirty(false); })}>Save reviewed result</button></div>
      </>}
      <div className="border-t border-slate-200 pt-4"><button className={secondary} onClick={() => void act(saveProgress)}>Save progress for later</button><p className="mt-2 text-slate-600">Use Save progress before leaving unfinished work. Saved progress and results are included in your private bill backup.</p></div>
    </fieldset>
  </section>;
}
