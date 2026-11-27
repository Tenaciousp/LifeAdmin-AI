import { useState } from "react";
import { copyDeviceText, openExternalDeviceUrl } from "./lib/offline/device-files.mjs";
import ExternalLink from "./ExternalLink";

type Source = { title: string; url: string };
type Grounding = { sources: Source[]; citations?: { claim: string; sources: Source[] }[]; search_suggestions_html?: string; checked_at: string; model?: string; provider?: string };

export default function LiveComparisonResult({ body, grounding }: { body: string; grounding: Grounding }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const checked = new Date(grounding.checked_at);
  const date = Number.isNaN(checked.getTime()) ? grounding.checked_at : checked.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const sources = [...new Map((grounding.sources || []).map(source => [source.url, source])).values()];
  const citations = grounding.citations || [];
  return <section aria-label="Live bill comparison" className="mt-4 rounded-xl border border-teal-300 bg-white p-4">
    <h4 className="text-lg font-bold text-teal-950">Live research result from {grounding.provider === "openai" ? "OpenAI" : grounding.provider === "anthropic" ? "Anthropic Claude" : "Google Gemini"}</h4>
    <p className="mt-2 text-sm text-slate-700">Sources checked: {date}. The comparison below is shown as returned. HomeAdmin has not confirmed provider prices, availability or eligibility.</p>
    <a className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-violet-800 underline underline-offset-2" href="#provider-comparison-email">Jump to editable provider message</a>
    <div aria-label="Unedited live comparison" className="mt-3 max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
      <pre className="whitespace-pre-wrap break-words font-sans text-base leading-7 text-slate-950">{body}</pre>
    </div>
    {grounding.search_suggestions_html && <details className="mt-4 rounded-lg border border-slate-200 p-3" onToggle={event => setShowSuggestions(event.currentTarget.open)}>
      <summary className="min-h-[44px] cursor-pointer py-2 font-bold">Related Google searches (optional)</summary>
      {showSuggestions && <iframe title="Google Search suggestions for this comparison" sandbox="allow-scripts allow-popups" referrerPolicy="no-referrer" srcDoc={grounding.search_suggestions_html} className="mt-2 min-h-24 w-full rounded-md border-0" />}
    </details>}
    {citations.length > 0 && <section aria-label="Sources linked to comparison claims" className="mt-4 rounded-lg border border-slate-200 p-3">
      <h5 className="font-bold">Sources for cited statements</h5>
      <ul className="mt-2 space-y-3">{citations.map((citation, index) => <li key={`${index}-${citation.claim}`} className="rounded-md bg-slate-50 p-3">
        <p className="whitespace-pre-wrap text-sm text-slate-800">{citation.claim}</p>
        <ul className="mt-2 list-disc pl-5">{citation.sources.map(source => <li key={source.url}><ExternalLink className="break-all font-semibold text-violet-800 underline" href={source.url}>{source.title || source.url}</ExternalLink></li>)}</ul>
      </li>)}</ul>
    </section>}
    {!citations.length && <section aria-label="Sources checked" className="mt-4 rounded-lg border border-slate-200 p-3">
      <h5 className="font-bold">Sources checked</h5>
      <ul className="mt-2 list-disc space-y-1 pl-5">{sources.map(source => <li key={source.url}><ExternalLink className="break-all font-semibold text-violet-800 underline" href={source.url}>{source.title || source.url}</ExternalLink></li>)}</ul>
    </section>}
    <p className="mt-3 text-sm text-amber-950">Treat savings as estimates until you open the provider pages and confirm the full cost, terms and eligibility. No provider has been contacted and nothing has been switched.</p>
  </section>;
}

export function ComparisonEmailEditor({ subject, body, onSubjectChange, onBodyChange }: {
  subject: string; body: string; onSubjectChange: (value: string) => void; onBodyChange: (value: string) => void;
}) {
  const [handoffStatus, setHandoffStatus] = useState("");
  const input = "mt-1 box-border min-h-[44px] w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
  return <section id="provider-comparison-email" tabIndex={-1} aria-label="Separate editable provider email" className="mt-4 scroll-mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700">
    <h4 className="font-bold text-violet-950">Editable email to ask your provider</h4>
    <p className="mt-2 text-sm text-slate-700">This is a separate draft based on the bill details you supplied. Add any offer details you have checked yourself. It does not change the live comparison above.</p>
    <label className="mt-3 block font-semibold">Subject<input className={input} maxLength={200} value={subject} onChange={event => onSubjectChange(event.target.value)} /></label>
    <label className="mt-3 block font-semibold">Message<textarea className={input} rows={8} maxLength={10000} value={body} onChange={event => onBodyChange(event.target.value)} /></label>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="min-h-[44px] rounded-xl border border-violet-400 bg-white px-4 py-2 font-semibold text-violet-900" onClick={() => {
        if (!subject.trim() || !body.trim()) { setHandoffStatus("Add a subject and message before opening your email app."); return; }
        const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setHandoffStatus("Opening your email app. Check the recipient and wording before sending.");
        void openExternalDeviceUrl(mailto).catch(() => setHandoffStatus("Email could not be opened. Copy the message into your provider's email or website form."));
      }}>Open in email app</button>
      <button type="button" className="min-h-[44px] rounded-xl border border-violet-400 bg-white px-4 py-2 font-semibold text-violet-900" onClick={() => {
        void copyDeviceText(`Subject: ${subject}\n\n${body}`).then(() => setHandoffStatus("Email copied. Paste it into your provider's email or website form.")).catch(() => setHandoffStatus("Copy failed. Select the subject and message above, then copy them manually."));
      }}>Copy email</button>
    </div>
    {handoffStatus && <p role="status" className="mt-2 text-sm text-slate-700">{handoffStatus}</p>}
    <p className="mt-2 text-sm text-slate-600">Check the recipient and message before sending. HomeAdmin does not send it for you.</p>
  </section>;
}
