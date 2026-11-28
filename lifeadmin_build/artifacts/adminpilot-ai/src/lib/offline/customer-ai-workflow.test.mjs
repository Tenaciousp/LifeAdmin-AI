import test from 'node:test';
import assert from 'node:assert/strict';
import {initialWorkflow,workflowResult,comparisonResult} from './bill-workflow.mjs';
const bill={id:'synthetic',title:'Synthetic broadband',category_id:'tv_broadband_mobile',goal_id:'prepare_renewal',details:{provider:'Example Broadband'}};
test('customer provider identity persists through progress and reviewed result',()=>{
 for(const provider of ['openai','anthropic','gemini']) {
 const draft={...initialWorkflow(bill),method:'customer_api',aiProvider:provider,output:'letter',subject:'Synthetic',body:'Synthetic enquiry',reviewed:true};
 const reopened=initialWorkflow({...bill,workflow_draft:draft});assert.equal(reopened.aiProvider,provider);
 const result=workflowResult(bill,{...reopened,reviewed:true});assert.equal(result.ai_service,provider+' API');assert.equal(result.source,'external_ai_api');
 }
});
test('comparison keeps original sourced answer and uses a complete AI email, with safe fallback',()=>{
 const raw='## Alternatives to consider\nFictional offer only\n## Editable provider email\nSubject: Synthetic renewal\nMessage: Please confirm full costs.\n## Details to confirm\nEligibility unknown.';
 const result=comparisonResult(bill,raw);assert.equal(result.body,raw);assert.equal(result.messageSubject,'Synthetic renewal');assert.equal(result.messageBody,'Please confirm full costs.');
 const fallback=comparisonResult(bill,'Synthetic answer without email');assert.match(fallback.messageBody,/Example Broadband/);assert.match(fallback.messageBody,/without my approval/);
 const incomplete=comparisonResult(bill,'## Editable provider email\nMessage: Fragment without subject','Reviewed subject','Reviewed body');assert.equal(incomplete.messageSubject,'Reviewed subject');assert.equal(incomplete.messageBody,'Reviewed body');
});
