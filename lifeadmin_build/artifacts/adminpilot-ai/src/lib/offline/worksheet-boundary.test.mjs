import test from 'node:test';
import assert from 'node:assert/strict';
import {locateEmail, replaceEmail} from './plan-email.mjs';
import {extractPlanSections} from './plan-sections.mjs';
import {hasDatedSourceReference} from './source-evidence.mjs';
const legacy = 'Savings comparison (customer-checked source, not independently verified by HomeAdmin)';
for (const title of [legacy, '## ' + legacy]) {
 const worksheet = `${title}\nCurrent monthly cost: £95\nAlternative monthly cost: £65\nOne-off fees: £20\n12-month difference: £340 (saving)\nCustomer-reviewed source URL: https://provider.example/offer\nChecked on: 2026-11-23\nEditable provider message:\nWorksheet letter`;
 test(`email copy/edit preserves worksheet: ${title}`, () => {
  const plan = `## Editable provider email\nSubject: Review price\nMessage: Please review my bill.\n\n${worksheet}`;
  const email = locateEmail(plan);
  assert.equal('Subject: '+email.subject+'\n\n'+email.message, 'Subject: Review price\n\nPlease review my bill.');
  const edited = replaceEmail(plan, email, 'Updated subject', 'Updated body');
  assert.ok(edited.includes(worksheet));
  const reopened = JSON.parse(JSON.stringify({body:edited})).body;
  assert.equal(locateEmail(reopened).message, 'Updated body');
  assert.ok(reopened.includes(worksheet));
 });
 test(`customer worksheet is excluded from AI source evidence: ${title}`, () => {
  const plan = `## Alternatives to consider\nUndated fictional offer with no source.\n${worksheet}`;
  assert.equal(hasDatedSourceReference(extractPlanSections(plan).alternatives),false);
  assert.equal(hasDatedSourceReference(extractPlanSections(`## Alternatives to consider\nFictional AI source https://provider.example/ai checked 2026-11-23\n${worksheet}`).alternatives),true);
 });
}
