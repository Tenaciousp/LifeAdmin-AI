import { copyDeviceText } from "./lib/offline/device-files.mjs";

type Segment = { start: number; end: number; header: string; subject: string; message: string };
const field = "mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white p-3 text-slate-900";
const button = "min-h-[44px] rounded-xl border border-violet-400 bg-white px-4 py-2 font-semibold text-violet-900";

function locateEmail(plan: string): Segment | null {
  const lines = plan.split("\n");
  const heading = /^(?:#{1,4}\s*)?(?:6[.)]\s*)?(?:Editable provider email|Provider-message draft|Provider email|Negotiation letter|Provider message)\s*:?\s*$/i;
  const index = lines.findIndex(line => heading.test(line.trim()));
  if (index < 0) return null;
  let stop = lines.length;
  for (let i = index + 1; i < lines.length; i++) {
    if (/^\s*#{1,4}\s+\S/.test(lines[i]) || /^\s*(?:Details to confirm|Things to check|Approval checklist)\s*:?\s*$/i.test(lines[i])) {
      stop = i; break;
    }
  }
  const email = lines.slice(index + 1, stop).join("\n").trim();
  const subjectLine = email.match(/^Subject:\s*(.*)$/im);
  const subject = subjectLine?.[1]?.trim() || "";
  const message = email.replace(/^Subject:.*(?:\n|$)/im, "").replace(/^\s*Message:\s*/i, "").trim();
  return { start: index, end: stop, header: lines[index], subject, message };
}
function replaceEmail(plan: string, segment: Segment, subject: string, message: string) {
  const lines = plan.split("\n");
  const replacement = [segment.header, "Subject: " + subject, "Message:", message.trim(), ""];
  return [...lines.slice(0, segment.start), ...replacement, ...lines.slice(segment.end)].join("\n");
}
export default function PlanEmailEditor({ plan, provider, onChange, onStatus, onError }: {
  plan: string;
  provider: string;
  onChange: (next: string) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}) {
  const detected = locateEmail(plan);
  const safeProvider = provider.trim().slice(0, 120);
  const section = detected || {
    start: plan.split("\\n").length, end: plan.split("\\n").length,
    header: "## Editable provider email",
    subject: "Request to review my bill and available options",
    message: "Hello " + (safeProvider || "Customer Services") + " team,\\n\\nI am reviewing my current bill and would appreciate details of your best available price and any suitable alternatives. Please confirm the monthly cost, total contract cost, duration, any price increases or charges, and the steps needed to proceed. I would prefer a written, itemised offer before making a decision.\\n\\nThank you.",
  };
  return <section aria-label="Provider email editor" className="rounded-xl border border-violet-200 bg-violet-50 p-4">
    <h4 className="font-bold text-violet-950">Your editable provider email</h4>
    <p className="mt-2 text-sm">{detected ? "Edits update the plan below." : "The AI response did not include an email, so HomeAdmin prepared a basic request using the saved provider name. Editing either field adds your email to the plan."} Check amounts and names before sending. Nothing is sent automatically.</p>
    <label className="mt-3 block font-semibold">Email subject
      <input className={field} value={section.subject} maxLength={200} onChange={e => onChange(replaceEmail(plan, section, e.target.value, section.message))} />
    </label>
    <label className="mt-3 block font-semibold">Email message
      <textarea className={field} rows={7} value={section.message} onChange={e => onChange(replaceEmail(plan, section, section.subject, e.target.value))} />
    </label>
    <button type="button" className={button + " mt-3"} onClick={() => {
      if (!section.subject.trim() || !section.message.trim()) { onError("Add an email subject and message before copying."); return; }
      if (!detected) onChange(replaceEmail(plan, section, section.subject, section.message));
      void copyDeviceText("Subject: " + section.subject + "\n\n" + section.message)
        .then(() => onStatus("Edited email copied. Review before sending."))
        .catch(() => onError("Unable to copy the email. Select the text and copy manually."));
    }}>Copy edited provider email</button>
  </section>;
}
