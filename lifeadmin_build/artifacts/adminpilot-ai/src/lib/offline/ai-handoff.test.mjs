import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiServices, aiActions, taskAiPrompt, promptFields, preferredAi, savePreferredAi } from './ai-handoff.mjs';
const plan = { title: 'PRIVATE TITLE', known_details: { provider: 'Example Broadband', amount: '£42/month', date: '2027-05-31', account_reference: 'PRIVATE-REF-7319', what_happened: 'PRIVATE FREE TEXT', unknown_field: 'PRIVATE UNKNOWN' }, provider_email: { subject: 'PRIVATE SUBJECT', body: 'PRIVATE LETTER' } };
test('prepared questions use selected facts and exclude identifiers/free text/draft by default', () => {
  const before = structuredClone(plan), prompt = taskAiPrompt(plan);
  assert.match(prompt, /Example Broadband/); assert.match(prompt, /£42\/month/);
  assert.doesNotMatch(prompt, /PRIVATE/); assert.deepEqual(plan, before);
  assert.equal(promptFields(plan).find(x => x.key === 'account_reference').selected, false);
});
test('explicit detail and draft choices are honoured without adding unselected facts', () => {
  const prompt = taskAiPrompt(plan, { action: 'letter', fieldKeys: ['account_reference'], includeDraft: true });
  assert.match(prompt, /PRIVATE-REF-7319/); assert.match(prompt, /PRIVATE LETTER/);
  assert.doesNotMatch(prompt, /Example Broadband|PRIVATE FREE TEXT|PRIVATE UNKNOWN|PRIVATE TITLE/);
  assert.throws(() => taskAiPrompt(plan, { fieldKeys: ['absent'] }), /Choose details/);
});
test('comparison requests source dates, actual research and total costs without uploading', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected network request'); };
  try {
    const prompt = taskAiPrompt(plan, { action: 'compare', fieldKeys: [] });
    for (const text of ['source links', 'date each offer', 'total contract cost', 'If live research is unavailable', 'Do not send messages', 'minimum location detail', 'None supplied']) assert.ok(prompt.includes(text), text);
    for (const action of aiActions) assert.ok(taskAiPrompt(plan, { action: action.id }).length);
  } finally { globalThis.fetch = originalFetch; }
});
test('invalid tasks and oversized questions fail without truncating saved records', () => {
  assert.throws(() => taskAiPrompt(plan, { action: 'unknown' }), /Choose an AI task/);
  const huge = { provider_email: { subject: 'Draft', body: 'x'.repeat(200000) } };
  assert.throws(() => taskAiPrompt(huge, { includeDraft: true }), /too long/);
  assert.equal(huge.provider_email.body.length, 200000);
});
test('AI preference persists, rejects unknown services and tolerates unavailable storage on read', () => {
  const values = new Map(), storage = { setItem: (k,v) => values.set(k,v), getItem: k => values.get(k) };
  assert.equal(preferredAi(storage), 'copilot');
  assert.match(aiServices.find(service => service.id === 'copilot').name, /Microsoft, free option/);
  assert.match(aiServices.find(service => service.id === 'gemini').name, /Google, free option/);
  for (const service of aiServices) { savePreferredAi(storage, service.id); assert.equal(preferredAi(storage), service.id); assert.equal(new URL(service.url).search, ''); }
  assert.throws(() => savePreferredAi(storage, 'unknown'), /supported/);
  assert.equal(preferredAi({ getItem() { throw new Error(); } }), 'copilot');
  assert.throws(() => savePreferredAi(null, 'claude'), /this session/);
  assert.throws(() => savePreferredAi({setItem() {}, getItem() { return null; }}, 'claude'), /this session/);
});

test('saved plan review requires explicit inclusion and preserves the original result', () => {
  const saved = { known_details: { provider: 'Example' }, content: 'PRIVATE PLAN: check the final invoice.', sections: { next_steps: 'Older fallback', approval_checklist: 'PRIVATE CHECKS' } };
  const before = structuredClone(saved);
  assert.doesNotMatch(taskAiPrompt(saved), /PRIVATE PLAN|Older fallback|PRIVATE CHECKS/);
  const prompt = taskAiPrompt(saved, { fieldKeys: [], includeDraft: true });
  assert.match(prompt, /PRIVATE PLAN: check the final invoice/);
  assert.doesNotMatch(prompt, /Older fallback|PRIVATE CHECKS|provider: Example/);
  assert.deepEqual(saved, before);
  assert.match(taskAiPrompt({ sections: { next_steps: 'Legacy next step' } }, { includeDraft: true }), /Legacy next step/);
  assert.throws(() => taskAiPrompt({ content: 'x'.repeat(200000) }, { includeDraft: true }), /too long/);
});
