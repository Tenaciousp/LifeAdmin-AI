// Standalone synthetic acceptance. No browser, device, provider or network is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { IDBFactory } from 'fake-indexeddb';
import { openLocalStore } from './storage.mjs';
import { initialWorkflow, workflowResult } from './bill-workflow.mjs';
import { locateEmail, replaceEmail } from './plan-email.mjs';
import { extractPlanSections } from './plan-sections.mjs';
import { hasDatedSourceReference } from './source-evidence.mjs';
const require = createRequire(import.meta.url);
const legacy = 'Savings comparison (customer-checked source, not independently verified by HomeAdmin)';
function renderWorksheet() {
 const source = fs.readFileSync(new URL('../../ComparisonWorksheet.tsx', import.meta.url), 'utf8');
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
 // Supply fictional form state, then execute the production component and its apply action.
 const states = [[], '95', {provider:'Fictional Alternative',monthly:'65',fee:'20',url:'https://provider.example/offer',checked:true}, '2026-11-23', '12 months; equivalent package; fixed price; no exit fee', '12', 'Request a written retention offer.', ''];
 let index = 0, applied = '';
 const exports = {};
 vm.runInNewContext(compiled, { exports, require: name => name === 'react' ? { useState: () => [states[index++], () => {}] } : require(name), URL, Intl, Date });
 const tree = exports.default({ provider:'Fictional Current', currentMonthly:95, onApply: text => { applied=text; } });
 const nodes = [];
 function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (node && typeof node==='object' && node.props) { nodes.push(node); visit(node.props.children); } }
 visit(tree);
 const texts = [];
 function text(node) { if(Array.isArray(node)) return node.forEach(text); if(typeof node==='string'||typeof node==='number') texts.push(String(node)); else if(node?.props) text(node.props.children); }
 text(tree);
 assert.match(texts.join(' '), /Indicative difference: £340\.00 less over 12 months/);
 const button = nodes.find(n => n.type==='button' && n.props.onClick);
 assert.equal(button.props.disabled,false);
 button.props.onClick();
 assert.match(applied,/12-month difference: £340\.00 \(saving\)/);
 assert.ok(applied.startsWith('## '+legacy));
 return applied;
}
test('production worksheet calculates £340 and emits a separate section', renderWorksheet);
test('external AI answer keeps email isolated and worksheet intact through actual IndexedDB close/reopen', async () => {
 const worksheet=renderWorksheet();
 const bill={id:'fictional-bill',title:'Fictional broadband',category_id:'tv_broadband_phone',goal_id:'reduce_price',status:'Open',details:{provider:'Fictional Current',currency:'GBP',amount:'95',billing_frequency:'Monthly'}};
 const ai='## Alternatives to consider\nFictional dated offer: https://provider.example/ai checked 2026-11-23\nSecond fictional offer: undated and unlinked; unverified.\n## Editable provider email\nSubject: Please review my price\nMessage: Please confirm your best equivalent offer.';
 const body=ai+'\n\n'+worksheet;
 const email=locateEmail(body);
 assert.equal('Subject: '+email.subject+'\n\n'+email.message,'Subject: Please review my price\n\nPlease confirm your best equivalent offer.');
 const edited=replaceEmail(body,email,'Reviewed subject','Reviewed fictional request.');
 const state={...initialWorkflow(bill),method:'chosen_ai',output:'plan',body:edited,reviewed:true};
 const plan=workflowResult(bill,state,'Copilot');
 const indexedDB=new IDBFactory(); let store=await openLocalStore({indexedDB});
 await store.createTask(bill); await store.savePlan(plan); store.close();
 store=await openLocalStore({indexedDB});
 const saved=(await store.read()).plans[0];
 assert.equal(saved.source,'external_ai_manual'); assert.equal(saved.ai_service,'Copilot');
 assert.ok(saved.content.includes(worksheet)); assert.equal(locateEmail(saved.content).message,'Reviewed fictional request.');
 const alternatives=extractPlanSections(saved.content).alternatives;
 assert.ok(alternatives.includes('undated and unlinked; unverified')); assert.ok(!alternatives.includes('Customer-reviewed source'));
 assert.equal(hasDatedSourceReference(alternatives),true);
 store.close();
});
