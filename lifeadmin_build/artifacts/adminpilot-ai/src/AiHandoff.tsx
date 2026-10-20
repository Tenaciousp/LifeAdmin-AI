import { useState } from "react";
import { aiServices, aiActions, promptFields, preferredAi, savePreferredAi, taskAiPrompt } from "./lib/offline/ai-handoff.mjs";
import { copyDeviceText } from "./lib/offline/device-files.mjs";

const button = "min-h-[44px] max-w-full rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:opacity-50";
const input = "box-border min-w-0 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";
function initialQuestion(plan: Record<string, any>) { try { return taskAiPrompt(plan); } catch { return ""; } }
function devicePreferences() { try { return window.localStorage; } catch { return null; } }

export default function AiHandoff({ plan, onClose, onMessage, onError }: {
  plan: Record<string, any>; onClose: () => void; onMessage: (text: string) => void; onError: (text: string) => void;
}) {
  const fields = promptFields(plan);
  const [service, setService] = useState(() => preferredAi(devicePreferences()));
  const [action, setAction] = useState("review");
  const [keys, setKeys] = useState(() => fields.filter(x => x.selected).map(x => x.key));
  const [includeDraft, setIncludeDraft] = useState(false);
  const [prompt, setPrompt] = useState(() => initialQuestion(plan));
  const [dirty, setDirty] = useState(false);
  const [choicesChanged, setChoicesChanged] = useState(false);
  const [copying, setCopying] = useState(false);
  const selectedService = aiServices.find(x => x.id === service)!;
  function rebuild() {
    if (dirty && !window.confirm("Replace your edited question using the selected task and details?")) return;
    try { setPrompt(taskAiPrompt(plan, { action, fieldKeys: keys, includeDraft })); setDirty(false); setChoicesChanged(false); onError(""); }
    catch (error) { onError(error instanceof Error ? error.message : "Question could not be prepared."); }
  }
  async function copy() {
    setCopying(true); onError("");
    try { await copyDeviceText(prompt); onMessage("AI prompt copied. Paste into your chosen service after reviewing the details."); }
    catch (error) { onError(error instanceof Error ? error.message : "Copy failed. Select the question and copy manually."); }
    finally { setCopying(false); }
  }
  return <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4" aria-labelledby="local-ai-heading">
    <h3 id="local-ai-heading" tabIndex={-1} className="font-bold">Review your AI prompt</h3>
    <p className="mt-3">Choose a task and the details to include. Review the prepared question before copying. Pasting into another service shares the text with that service.</p>
    <label className="mt-4 block">Your preferred AI<select className={input + " mt-1"} value={service} onChange={event => {
      const id = event.target.value; setService(id);
      try { savePreferredAi(devicePreferences(), id); onError(""); onMessage("Preferred AI saved on this device."); }
      catch (error) { onError(error instanceof Error ? error.message : "AI preference was not saved."); }
    }}>{aiServices.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <p className="mt-2">Use your own free or paid account. AI access, limits and charges are separate from HomeAdmin. Your preference is device-specific and is not included in bill backups.</p>
    <label className="mt-4 block">What should AI help with?<select className={input + " mt-1"} value={action} onChange={event => { setAction(event.target.value); setChoicesChanged(true); }}>{aiActions.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <fieldset className="mt-4 min-w-0"><legend className="font-semibold">Details to include</legend><p className="mt-2">References, free-text notes and the saved message are excluded unless selected. Check every chosen value for private information.</p>
      {fields.map(field => <label key={field.key} className="mt-2 flex min-h-[44px] items-start gap-3 rounded-lg bg-white p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={keys.includes(field.key)} onChange={event => { setKeys(value => event.target.checked ? [...value, field.key] : value.filter(key => key !== field.key)); setChoicesChanged(true); }} /><span className="min-w-0"><strong>{field.label}</strong><span className="block whitespace-pre-wrap">{field.value}</span></span></label>)}
      {plan.provider_email && <label className="mt-2 flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={includeDraft} onChange={event => { setIncludeDraft(event.target.checked); setChoicesChanged(true); }} />Include saved message, which might contain personal details</label>}
    </fieldset>
    <button className={button + " mt-3"} onClick={rebuild}>Prepare question</button>
    {choicesChanged && <p role="status" className="mt-3 font-semibold">Task or details changed. Prepare the question again before copying.</p>}
    <p className="mt-3">Question edits are temporary. Save any returned letter in the message editor before closing the app.</p>
    <label className="mt-3 block">AI prompt<textarea className={input + " mt-1"} rows={12} maxLength={200000} value={prompt} onChange={event => { setPrompt(event.target.value); setDirty(true); }} /></label>
    <div className="mt-3 flex flex-wrap gap-3"><button disabled={!prompt.trim() || choicesChanged || copying} className={button} onClick={() => void copy()}>{copying ? "Copying…" : "Copy AI prompt"}</button><a className={button + " inline-flex items-center"} href={selectedService.url} target="_blank" rel="noopener noreferrer">Open {selectedService.name}</a><button className={button} onClick={() => { if (!dirty || window.confirm("Close and discard the edited AI question?")) onClose(); }}>Close AI prompt</button></div>
    <p className="mt-4">1. Copy the reviewed question. 2. Open your AI and paste. 3. Review the reply, return here and paste your letter into Edit message, then Save message. Opening the service sends no bill details. Replies are not imported automatically.</p>
    {action === "compare" && <p className="mt-3">Ask for dated sources and check offers on provider websites. AI research is not a verified live price comparison.</p>}
  </section>;
}
