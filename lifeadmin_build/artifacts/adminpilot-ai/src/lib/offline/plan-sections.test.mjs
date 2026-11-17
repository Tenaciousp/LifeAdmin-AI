import test from "node:test";
import assert from "node:assert/strict";
import { extractPlanSections } from "./plan-sections.mjs";

test("reads prescribed Markdown headings with numbered labels", () => {
  const answer = "## 1. My bill at a glance\n£45 per month\n## 2. My action list\n1. Check dates\n## Alternatives to consider\nNo verified offers\n## Estimated savings\nNot available: no verified like-for-like prices\n## My first next step\nContact the provider";
  assert.deepEqual(extractPlanSections(answer), {
    bill: "£45 per month", recommendation: "Contact the provider",
    alternatives: "No verified offers", actions: "1. Check dates",
    savings: "Not available: no verified like-for-like prices",
  });
});
test("accepts differently worded Copilot headings without guessing prices", () => {
  const reply = "## Current charges:\n£52/month\n## Recommendation\nAsk for a renewal quote\n## Other options\nCompare like-for-like\n## Possible savings\nUnknown";
  const sections = extractPlanSections(reply);
  assert.equal(sections.bill, "£52/month");
  assert.equal(sections.recommendation, "Ask for a renewal quote");
  assert.equal(sections.alternatives, "Compare like-for-like");
  assert.equal(sections.savings, "Unknown");
});
test("does not invent sections from unstructured or unrelated text", () => {
  assert.deepEqual(extractPlanSections("I think switching saves £200"), {
    bill: "", recommendation: "", alternatives: "", actions: "", savings: "",
  });
  assert.equal(extractPlanSections("## Details to confirm\n£99\n## Recommendation\nCheck first").bill, "");
});
test("section parsing preserves bullets and stops at unrelated headings", () => {
  const result = extractPlanSections("## Provider comparison\n- Provider A\n- Provider B\n## Details to confirm\nCheck fees\n## Next steps\n1. Call current provider");
  assert.equal(result.alternatives, "- Provider A\n- Provider B");
  assert.equal(result.actions, "1. Call current provider");
});
