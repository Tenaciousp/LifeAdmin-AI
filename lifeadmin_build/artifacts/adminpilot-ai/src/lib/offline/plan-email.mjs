export function locateEmail(plan) {
  const lines = plan.split("\n");
  const heading = /^(?:#{1,4}\s*)?(?:6[.)]\s*)?(?:Editable provider email|Provider-message draft|Provider email|Negotiation letter|Provider message)\s*:?\s*$/i;
  const index = lines.findIndex(line => heading.test(line.trim()));
  if (index < 0) return null;
  let stop = lines.length;
  for (let i = index + 1; i < lines.length; i++) {
    if (lines[i].trim() === "Savings comparison (customer-checked source, not independently verified by HomeAdmin)" || /^\s*#{1,4}\s+\S/.test(lines[i]) || /^\s*(?:Details to confirm|Things to check|Approval checklist)\s*:?\s*$/i.test(lines[i])) {
      stop = i; break;
    }
  }
  const email = lines.slice(index + 1, stop).join("\n").trim();
  const subjectLine = email.match(/^Subject:\s*(.*)$/im);
  const subject = subjectLine?.[1]?.trim() || "";
  const message = email.replace(/^Subject:.*(?:\n|$)/im, "").replace(/^\s*Message:\s*/i, "").trim();
  return { start: index, end: stop, header: lines[index], subject, message };
}
export function replaceEmail(plan, segment, subject, message) {
  const lines = plan.split("\n");
  const replacement = [segment.header, "Subject: " + subject, "Message:", message.trim(), ""];
  return [...lines.slice(0, segment.start), ...replacement, ...lines.slice(segment.end)].join("\n");
}

// Derive legacy inline emails without rewriting saved records or backups.
export function savedPlanEmail(plan) {
  if (!plan) return null;
  if (plan.provider_email) return plan.provider_email;
  if (plan.workflow_output !== "plan" || !["external_ai_manual", "external_ai_api"].includes(plan.source)) return null;
  const email = locateEmail(String(plan.content || ""));
  return email ? { subject: email.subject, body: email.message, kind: "provider" } : null;
}
