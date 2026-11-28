import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {mapBillText,confirmBillReview,intakeDate} from './bill-intake.mjs';
import {openLocalStore} from './storage.mjs';
import {IDBFactory} from 'fake-indexeddb';
const require=createRequire(import.meta.url);
const raw='Provider: Example Broadband\nMonthly price: £89\nContract end date: 31 January 2027\nOne-off fee: £20\nAccount reference: FICTIONAL-12345\nAddress: FICTIONAL PRIVATE ADDRESS';
const fields={provider:'Example Broadband',amount:'89.00',contract_end_date:'2027-01-31',one_off_fee:'20.00'};
test('fabricated UK renewal maps only explicit fields and separates fee from monthly price',()=>{
 assert.deepEqual(mapBillText({status:'recognized',text:raw}).fields,fields);
 assert.doesNotMatch(JSON.stringify(mapBillText({status:'recognized',text:raw})),/FICTIONAL|Account reference|Address/);
 assert.throws(()=>confirmBillReview(fields,false),/Confirm/);
 assert.deepEqual(confirmBillReview({...fields,account_reference:'FICTIONAL-12345',raw_text:raw},true),{...fields,currency:'GBP',billing_frequency:'Monthly'});
});
test('ambiguous prices and dates, impossible dates and unlabeled totals are not inferred',()=>{
 for(const text of ['Monthly price: £89 or £99','Monthly price: £89\nMonthly price: £99','Monthly price: 89','Total £89']) assert.equal(mapBillText({status:'recognized',text}).fields.amount,'');
 for(const text of ['01/02/2027','31 February 2027','2027-02-30','next January']) assert.equal(intakeDate(text),'');
 assert.equal(mapBillText({status:'recognized',text:'Contract end date: 31 January 2027\nContract end date: 28 February 2027'}).fields.contract_end_date,'');
 assert.throws(()=>confirmBillReview({...fields,amount:'89 or 99'},true),/Check/);
});
test('cancel, unreadable, oversized and unrecognized inputs return manual fallback without raw content',()=>{
 for(const result of [null,{status:'cancelled',text:raw},{status:'unreadable',text:raw},{status:'recognized',text:''},{status:'recognized',text:'x'.repeat(20001)},{status:'recognized',text:'FICTIONAL-12345'}]) {
  const mapped=mapBillText(result); assert.equal(mapped.status,'manual'); assert.doesNotMatch(JSON.stringify(mapped),/FICTIONAL|raw_text/);
 }
});
test('only confirmed safe fields reach local records, exported backups and AI preparation',async()=>{
 const {workflowPrompt,initialWorkflow}=await import('./bill-workflow.mjs');
 const store=await openLocalStore({indexedDB:new IDBFactory()});
 const baseline=await store.read();mapBillText({status:'cancelled',text:raw});assert.deepEqual(await store.read(),baseline);
 const details=confirmBillReview(mapBillText({status:'recognized',text:raw}).fields,true);
 const bill={id:'photo-fixture',title:'Fictional broadband',category_id:'tv_broadband_phone',goal_id:'reduce_price',details};
 await store.createTask(bill);
 for(const text of [JSON.stringify(await store.read()),await store.exportBackup(),workflowPrompt(bill,initialWorkflow(bill))]) assert.doesNotMatch(text,/FICTIONAL-12345|PRIVATE ADDRESS|Account reference:/);
 store.close();
});
test('review component edits reset consent, explicit confirmation applies only safe fields, cancel does not apply',()=>{
 const source=fs.readFileSync(new URL('../../BillPhotoReview.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={},states=[];let index=0,applied=[],cancelled=0;
 vm.runInNewContext(compiled,{exports,require:name=>name==='react'?{useState:initial=>{const i=index++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=value;}];}}:name.includes('bill-intake')?{confirmBillReview}:require(name)});
 const render=()=>{index=0;const tree=exports.default({candidates:fields,onApply:v=>applied.push(v),onCancel:()=>cancelled++});const nodes=[];const visit=n=>{if(Array.isArray(n))n.forEach(visit);else if(n?.props){nodes.push(n);visit(n.props.children);}};visit(tree);return nodes;};
 let nodes=render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(applied.length,0);
 nodes=render();nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
 nodes=render();nodes.find(n=>n.type==='input'&&n.props.value==='89.00').props.onChange({target:{value:'88.00'}});
 nodes=render();assert.equal(nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,false);
 nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
 nodes=render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(applied[0].amount,'88.00');assert.equal(Object.keys(applied[0]).length,6);
 nodes.find(n=>n.type==='button'&&n.props.type==='button').props.onClick();assert.equal(cancelled,1);assert.equal(applied.length,1);
});

test('confirmed review fills the unsaved form using the existing contract diary field and preserves unrelated edits',async()=>{
 const {applyReviewedBill}=await import('./bill-intake.mjs');
 const original={bill_type:'Broadband',country:'United Kingdom',renewal_date:'2027-01-20',custom:'Retain typed value',provider:'Old provider'};
 const before=structuredClone(original);
 assert.throws(()=>applyReviewedBill(original,fields,false),/Confirm/);
 assert.deepEqual(original,before);
 const next=applyReviewedBill(original,{...fields,account_reference:'FICTIONAL-12345',raw_text:raw},true);
 assert.equal(next.contract_expiry,'2027-01-31');assert.equal(next.one_off_fee,'20.00');
 assert.equal(next.amount,'89.00');assert.equal(next.provider,'Example Broadband');
 assert.equal(next.custom,original.custom);assert.equal(next.renewal_date,original.renewal_date);
 assert.doesNotMatch(JSON.stringify(next),/FICTIONAL-12345|PRIVATE ADDRESS|raw_text|contract_end_date/);
 assert.deepEqual(original,before);
});
