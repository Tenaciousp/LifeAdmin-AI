// Deterministic local repository evidence only. No browser, clipboard or provider calls.
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {openLocalStore} from '../artifacts/adminpilot-ai/src/lib/offline/storage.mjs';
import {diaryEvents,diaryAlertState} from '../artifacts/adminpilot-ai/src/lib/offline/diary.mjs';
import {initialWorkflow,workflowPrompt,workflowResult,comparisonResult} from '../artifacts/adminpilot-ai/src/lib/offline/bill-workflow.mjs';
import {assessBroadbandFixture} from '../artifacts/adminpilot-ai/src/lib/offline/broadband-fixture.mjs';
export async function runBroadbandStates(){
 const started=performance.now(), indexedDB=new IDBFactory(),name='synthetic-friday-journey';
 let store=await openLocalStore({indexedDB,name});
 const prior={id:'preserved',title:'Existing synthetic record',details:{amount:'12',currency:'GBP'}};
 const bill={id:'friday-broadband',title:'Synthetic broadband renewal',category_id:'tv_broadband_mobile',goal_id:'prepare_renewal',status:'Open',notes:'Synthetic decision not yet recorded',details:{bill_type:'Broadband',provider:'Example Broadband',country:'United Kingdom',currency:'GBP',amount:'89',billing_frequency:'Monthly',diary_enabled:'yes',diary_lead_days:'14',contract_expiry:'2026-12-12'}};
 await store.createTask(prior);await store.createTask(bill);
 const reminder=diaryEvents((await store.read()).tasks)[0];assert.equal(reminder.key,bill.id+'/contract_expiry');
 assert.equal(diaryAlertState(reminder,new Date('2026-11-24T10:00Z')).status,'future');
 let draft={...initialWorkflow(bill),step:2,brief:'Compare equivalent broadband renewal terms and prepare a provider email'};
 const prompt=workflowPrompt(bill,draft);draft={...draft,step:3};
 await store.saveWorkflowProgress(bill.id,draft);store.close();store=await openLocalStore({indexedDB,name});
 let saved=(await store.read()).tasks.find(t=>t.id===bill.id);assert.equal(workflowPrompt(saved,initialWorkflow(saved)),prompt);
 const row=assessBroadbandFixture(bill,{source:{url:'https://offers.provider.example/broadband',checkedOn:'2026-11-24'},activeFrom:'2026-11-01',activeUntil:'2026-12-31',periods:[{months:12,monthly:'65'},{months:12,monthly:'69'}],oneOffFee:'20',currency:'GBP',service:'broadband',speedMbps:100,featuresMatch:true,feesComplete:true,priceChangesComplete:true,equivalenceConfirmed:true},{speedMbps:100},new Date('2026-11-24T10:00Z'));
 assert.equal(row.currentTotal,2136);assert.equal(row.alternativeTotal,1628);assert.equal(row.indicativeSaving,508);assert.equal(row.addressEligibility,'unverified');
 const body='## Best next action\nAsk the current provider for a written equivalent offer.\n## Alternatives to consider\nFictional fixture only; no live offer or address eligibility verified. Source https://offers.provider.example/broadband checked 24 November 2026.\n## Estimated savings\nIndicative GBP 508 over 24 months: current 89 x 24 = 2136 assuming no current rises; alternative 65 x 12 + 69 x 12 + 20 fee = 1628. Features customer-confirmed for this fixture only.\n## Editable provider email\nSubject: Please review my broadband renewal\nMessage: Please confirm your best equivalent broadband price, scheduled rises, full 24-month cost and fees in writing. No changes are authorised.\n## Details to confirm\nAvailability and actual eligibility remain unknown.';
 const separated=comparisonResult(bill,body);assert.equal(separated.body,body);assert.doesNotMatch(separated.messageBody,/Details to confirm/);
 const letter={...initialWorkflow(saved),step:4,output:'letter',method:'chosen_ai',subject:separated.messageSubject,body:separated.messageBody+' Please include all equipment charges.',reviewed:true};
 const result=workflowResult(bill,letter,'Copilot');await store.saveWorkflowResult(result,draft);
 const expected=result.provider_email;const edited={subject:'Reviewed broadband renewal enquiry',body:expected.body+' I will review before deciding.'};
 await store.updatePlanMessage(result.id,edited,expected);
 await store.updateTask(bill.id,{notes:'Decision: ask current provider for a written offer; no switch agreed.',details:{...bill.details,follow_up_date:'2026-12-03',diary_lead_days:'0'}});
 store.close();store=await openLocalStore({indexedDB,name});const snapshot=await store.read();
 const reopened=snapshot.plans.find(p=>p.id===result.id);assert.deepEqual(reopened.provider_email,{...expected,...edited});
 const copy='Subject: '+reopened.provider_email.subject+'\n\n'+reopened.provider_email.body;
 assert.doesNotMatch(copy,/508|2136|1628|Alternatives to consider/);assert.match(copy,/equipment charges/);
 saved=snapshot.tasks.find(t=>t.id===bill.id);assert.match(saved.notes,/Decision: ask/);assert.equal(saved.workflow_draft,undefined);
 const follow=diaryEvents(snapshot.tasks).filter(e=>e.key===bill.id+'/follow_up_date');assert.equal(follow.length,1);assert.equal(follow[0].date,'2026-12-03');assert.equal(follow[0].leadDays,0);
 assert.deepEqual(snapshot.tasks.find(t=>t.id===prior.id),prior);assert.equal(snapshot.plans.length,1);store.close();
 console.log(JSON.stringify({status:'PASS',evidence:'synthetic state transitions only; no browser/device/clipboard/live sourcing',transitions:['upcoming renewal','confirm bill','save/reopen prompt','indicative comparison with rise and fee','edit/review letter','save/reopen letter','email-only copy payload','explicit decision','updated follow-up after reopen','existing record preserved'],indicativeSaving:508,elapsedMs:Math.round(performance.now()-started)}));
}
if(process.argv[1]?.endsWith('qa_broadband_states.mjs'))runBroadbandStates().catch(e=>{console.error(e);process.exitCode=1;});
