import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { initialWorkflow, localWorkflowDraft, workflowFields, workflowPrompt, workflowResult } from "./bill-workflow.mjs";
import { openLocalStore } from "./storage.mjs";
import { openNativeStore } from "./native-store.mjs";
import { planTextForCopy } from "./plans.mjs";

const bill = { id: "bill-workflow", title: "Example water", category_id: "water", goal_id: "check_bill", status: "Open", details: { provider: "Example Water", country: "Canada", currency: "CAD", amount: "45", billing_frequency: "Monthly", water_region: "Ontario", billing_basis: "Metered", account_reference: "PRIVATE-REFERENCE", what_happened: "PRIVATE-NOTES" } };
const draft = output => ({ ...initialWorkflow(bill), output, reviewed: true, subject: "Reviewed subject", body: "Reviewed result" });

test("guided bill choices exclude references and free-text facts unless explicitly selected", () => {
  const state = initialWorkflow(bill);
  assert.equal(state.output, "plan"); assert.equal(state.method, "chosen_ai");
  const prompt = workflowPrompt(bill, state);
  assert.match(prompt, /Example Water/); assert.match(prompt, /Canada/); assert.match(prompt, /CAD/);
  assert.doesNotMatch(prompt, /PRIVATE/);
  assert.equal(workflowFields(bill).find(x => x.key === "account_reference").selected, false);
  assert.throws(() => workflowPrompt(bill, { ...state, fieldKeys: ["unexpected"] }), /Choose details/);
  const explicit = workflowPrompt(bill, { ...state, fieldKeys: ["account_reference"] });
  assert.match(explicit, /PRIVATE-REFERENCE/); assert.doesNotMatch(explicit, /Example Water|PRIVATE-NOTES/);
});
test("reply requests include the exact provider message and requested outcome without accepting offers", () => {
  const state = { ...draft("reply"), incoming: "We offer a credit of CAD 12. Please confirm acceptance.", brief: "Clarify the remaining charges", tone: "Firm and factual", language: "French" };
  const prompt = workflowPrompt(bill, state);
  for (const text of [state.incoming, state.brief, state.tone, "French", "Do not accept an offer", "untrusted reference material", "Return a separate subject"]) assert.ok(prompt.includes(text), text);
  assert.throws(() => workflowPrompt(bill, { ...state, incoming: "" }), /Paste the provider message/);
  assert.throws(() => workflowPrompt(bill, { ...state, incoming: "x".repeat(10001) }), /Shorten/);
  assert.throws(() => workflowPrompt(bill, { ...state, language: "unknown" }), /supported/);
});
test("local drafts stay explicit templates and never pretend to analyse an incoming reply", () => {
  const before = structuredClone(bill);
  for (const output of ["plan", "letter", "reply"]) assert.ok(localWorkflowDraft(bill, output).body);
  assert.match(localWorkflowDraft(bill, "reply", "Explain charges").body, /Explain charges/);
  assert.match(localWorkflowDraft(bill, "reply").body, /\[Add the questions/);
  assert.deepEqual(bill, before);
});
test("reviewed results retain preparation source and never mark the bill paid or close its task", () => {
  const before = structuredClone(bill);
  for (const output of ["plan", "letter", "reply"]) {
    const note = workflowResult(bill, draft(output), "ChatGPT");
    assert.equal(note.source, "external_ai_manual"); assert.equal(note.workflow_output, output);
    assert.equal(note.ai_service, "ChatGPT");
    assert.match(planTextForCopy(note), /Reviewed result/);
    assert.match(planTextForCopy(note), /Nothing has been sent/);
    if (output !== "plan") assert.equal(note.provider_email.body, "Reviewed result");
    else assert.equal(note.provider_email, null);
  }
  assert.equal(workflowResult(bill, { ...draft("letter"), method: "local" }).source, "local");
  assert.deepEqual(bill, before);
});
test("empty, oversized and unreviewed results fail instead of silently truncating", () => {
  for (const patch of [{ reviewed: false }, { body: "" }, { body: "x".repeat(20001) }, { subject: "" }, { subject: "x".repeat(201) }, { output: "unknown" }, { method: "unknown" }]) assert.throws(() => workflowResult(bill, { ...draft("letter"), ...patch }));
});
test("unfinished progress reopens safely and always requires a fresh review", () => {
  const state = { ...draft("reply"), step: 4, incoming: "Original message", brief: "Clarify a reading" };
  const reopened = initialWorkflow({ ...bill, workflow_draft: state });
  assert.equal(reopened.incoming, state.incoming); assert.equal(reopened.body, state.body);
  assert.equal(reopened.reviewed, false); assert.equal(reopened.step, 4);
  const invalid = initialWorkflow({ ...bill, workflow_draft: { step: 50, output: "unknown", fieldKeys: ["__proto__"], body: "x".repeat(20001) } });
  assert.equal(invalid.step, 1); assert.equal(invalid.output, "plan"); assert.equal(invalid.body, ""); assert.deepEqual(invalid.fieldKeys, []);
});
test("progress and separately saved results survive close, reopen and backup restore", async () => {
  const indexedDB = new IDBFactory();
  let store = await openLocalStore({ indexedDB });
  await store.createTask(bill);
  await store.updateTask(bill.id, { workflow_draft: { ...draft("reply"), incoming: "Provider response", step: 4 } });
  const first = workflowResult(bill, draft("letter"), "ChatGPT");
  const second = workflowResult(bill, { ...draft("reply"), body: "<script>literal text</script>" }, "Gemini");
  await store.savePlan(first); await store.savePlan(second);
  const backup = await store.exportBackup(); store.close();
  store = await openLocalStore({ indexedDB });
  assert.equal((await store.read()).tasks[0].workflow_draft.incoming, "Provider response");
  await store.importBackup(backup, { replace: true });
  const saved = await store.read();
  assert.equal(saved.plans.length, 2); assert.equal(saved.plans.find(note => note.id === first.id).provider_email.body, "Reviewed result");
  assert.equal(saved.plans.find(note => note.id === second.id).provider_email.body, second.provider_email.body);
  assert.equal(saved.tasks[0].status, "Open"); store.close();
});
test("native progress and reviewed results use the same compatible backup contract", async () => {
  let snapshot = null, revision = "empty";
  const bridge = { async read() { return { snapshot, revision }; }, async write(input) { assert.equal(input.expectedRevision, revision); snapshot = input.snapshot; revision = String(Number(revision) + 1 || 1); } };
  let store = await openNativeStore(bridge); await store.createTask(bill);
  await store.updateTask(bill.id, { workflow_draft: { ...draft("plan"), step: 3 } });
  await store.savePlan(workflowResult(bill, draft("plan"), "ChatGPT")); store.close();
  store = await openNativeStore(bridge);
  assert.equal((await store.read()).tasks[0].workflow_draft.step, 3);
  assert.equal((await store.read()).plans[0].source, "external_ai_manual"); store.close();
});

for (const native of [false, true]) test(`${native ? "native" : "browser"} result save clears progress atomically and failed saves preserve previous work`, async () => {
  let snapshot = null, revision = "empty", failWrite = false;
  const bridge = { async read() { return { snapshot, revision }; }, async write(input) { if (failWrite) throw new Error("Synthetic write failure"); assert.equal(input.expectedRevision, revision); snapshot = input.snapshot; revision = String(Number(revision) + 1 || 1); } };
  const store = native ? await openNativeStore(bridge) : await openLocalStore({ indexedDB: new IDBFactory() });
  const progress = { ...draft("reply"), step: 4, incoming: "Provider message" };
  await store.createTask({ ...bill, workflow_draft: progress });
  const original = workflowResult(bill, draft("letter"), "ChatGPT");
  await store.savePlan(original);
  const result = workflowResult(bill, draft("reply"), "ChatGPT");
  await store.saveWorkflowResult(result);
  let data = await store.read();
  assert.equal(data.tasks[0].workflow_draft, undefined);
  assert.deepEqual(data.tasks[0].details, bill.details);
  assert.equal(data.tasks[0].status, "Open");
  // IndexedDB reads by primary key; native storage retains insertion order.
  // Compare complete records by identity, not a random UUID's sort position.
  const byId = values => [...values].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(byId(data.plans), byId([original, result]));
  await store.updateTask(bill.id, { workflow_draft: progress });
  const acknowledged = await store.read();
  await assert.rejects(store.saveWorkflowResult(result));
  assert.deepEqual(await store.read(), acknowledged);
  if (native) {
    failWrite = true;
    await assert.rejects(store.saveWorkflowResult(workflowResult(bill, draft("plan"))), /Synthetic write failure/);
    assert.deepEqual(await store.read(), acknowledged);
  }
  store.close();
});
