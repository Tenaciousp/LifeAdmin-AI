import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openLocalStore, planWithEditedMessage } from './storage.mjs';
import { locateEmail, savedPlanEmail } from './plan-email.mjs';
import { planTextForCopy } from './plans.mjs';
const worksheet='Savings comparison (customer-checked source, not independently verified by HomeAdmin)\nCustomer-reviewed source URL: https://provider.example/offer\nChecked on: 2026-11-23\n12-month difference: £268';
const content='## Alternatives to consider\nFictional offer.\n## Editable provider email\nSubject: Old subject\nMessage: Old message\n\n'+worksheet;
const plan={id:'p',task_id:'b',title:'Fictional bill plan',workflow_output:'plan',source:'external_ai_manual',provider_email:null,content,sections:{alternatives:'Fictional offer.'}};
const expected={subject:'Old subject',body:'Old message',kind:'provider'};
test('saved inline AI email edits persist without duplicating or leaving stale Copy plan text',async()=>{
 const indexedDB=new IDBFactory();let store=await openLocalStore({indexedDB});
 await store.createTask({id:'b',title:'Fictional bill'});await store.savePlan(plan);
 await store.updatePlanMessage('p',{subject:'New subject',body:'New message'},expected);
 store.close();store=await openLocalStore({indexedDB});
 const saved=(await store.read()).plans[0];const email=locateEmail(saved.content);
 assert.equal(email.subject,'New subject');assert.equal(email.message,'New message');
 assert.ok(saved.content.includes(worksheet));assert.deepEqual(saved.sections,plan.sections);
 const copy=planTextForCopy(saved);assert.doesNotMatch(copy,/Old subject|Old message/);
 assert.equal(copy.match(/Subject: New subject/g).length,1);assert.ok(copy.includes(worksheet));
 await assert.rejects(store.updatePlanMessage('p',{subject:'Stale',body:'Stale'},expected),/Message changed/);store.close();
});
test('standalone letters retain their existing dedicated email behavior',()=>{
 const letter={...plan,workflow_output:'letter',provider_email:expected,content:'Original letter'};
 const edited=planWithEditedMessage(letter,{subject:'New',body:'Reviewed'},expected);
 assert.equal(edited.provider_email.body,'Reviewed');assert.equal(edited.content,'Original letter');
});

test('reopened AI plans expose inline email actions while local plans stay unchanged',()=>{
 assert.deepEqual(savedPlanEmail(plan),expected);
 assert.deepEqual(savedPlanEmail({...plan,source:'external_ai_api'}),expected);
 assert.equal(savedPlanEmail({...plan,source:'local'}),null);
 assert.equal(savedPlanEmail({...plan,content:'No email section'}),null);
 const reply={...plan,workflow_output:'reply',provider_email:expected};
 assert.deepEqual(savedPlanEmail(reply),expected);
 assert.equal(planWithEditedMessage(reply,{subject:'Reply',body:'Reviewed reply'},expected).provider_email.body,'Reviewed reply');
});
