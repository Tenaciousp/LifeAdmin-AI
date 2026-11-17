/**
 * Interpret headings in AI replies without treating unlabelled prose as verified.
 * Keep the original answer intact; missing sections remain missing.
 */
const headingKinds = [
  ["bill", /^(?:my bill at a glance|current bill(?: summary)?|current (?:cost|charges)|bill (?:summary|overview)|your current bill|what you pay(?: now)?)$/i],
  ["recommendation", /^(?:best next action|my first next step|recommended (?:next )?action|recommendation|my recommendation|what (?:to do|i should do) next|best option(?: for you)?)$/i],
  ["alternatives", /^(?:alternatives to consider|comparison of alternatives|provider comparison|compare (?:providers|options)|comparison(?: table)?|alternative (?:providers|options|deals)|options to consider|other (?:providers|options)|staying or switching)$/i],
  ["actions", /^(?:my action list|action list|next steps|steps to take|action plan|what to do next)$/i],
  ["savings", /^(?:estimated savings?|potential savings?|saving estimates?|possible savings?|cost difference|cost comparison|monthly savings?)$/i],
];
const normalise = label => label.replace(/\*\*/g, "").replace(/^[\d]+[.):]\s*/, "").replace(/\s*[:.?]\s*$/, "").replace(/\s+/g, " ").trim();
export function extractPlanSections(text) {
  const sections = { bill: "", recommendation: "", alternatives: "", actions: "", savings: "" };
  if (typeof text !== "string") return sections;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const heading = line => {
    const match = line.trim().match(/^#{1,4}\s+(.+)$/);
    if (!match) return null;
    const normalized = normalise(match[1]);
    for (const [key, regex] of headingKinds) if (regex.test(normalized)) return key;
    return "other";
  };
  let active = null;
  let buffer = [];
  const flush = () => {
    if (active && active !== "other" && !sections[active]) {
      sections[active] = buffer.join("\n").trim();
    }
    buffer = [];
  };
  for (const line of lines) {
    const kind = heading(line);
    if (kind !== null) { flush(); active = kind; }
    else if (active !== null) buffer.push(line);
  }
  flush();
  return sections;
}
