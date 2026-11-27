import test from 'node:test';
import assert from 'node:assert/strict';
import {compareBroadbandFixture,assessBroadbandFixture} from './broadband-fixture.mjs';
const now=new Date('2026-11-24T10:00:00Z');
const requirements={country:'United Kingdom',speedMbps:100,address:'PRIVATE ADDRESS',account:'PRIVATE REF',notes:'PRIVATE NOTES'};
const bill={title:'PRIVATE TITLE',notes:'PRIVATE NOTES',details:{provider:'PRIVATE PROVIDER',amount:'89',currency:'GBP',billing_frequency:'Monthly',account_reference:'PRIVATE REF',address:'PRIVATE ADDRESS'}};
const offer={source:{url:'https://offers.provider.example/broadband',checkedOn:'2026-11-24'},retrievedAt:'2026-11-24T09:59:00Z',activeFrom:'2026-11-01',activeUntil:'2026-12-31',periods:[{months:12,monthly:'65'},{months:12,monthly:'69'}],oneOffFee:'20',currency:'GBP',service:'broadband',speedMbps:100,featuresMatch:true,feesComplete:true,priceChangesComplete:true,equivalenceConfirmed:true,addressEligibility:'supported'};
test('fake outbound adapter receives public requirements only; fixture costs preserve dated source',async()=>{
 let calls=0;
 const result=await compareBroadbandFixture(bill,requirements,async query=>{calls++;assert.deepEqual(query,{service:'broadband',country:'United Kingdom',minimumSpeedMbps:100});assert.doesNotMatch(JSON.stringify(query),/PRIVATE|89|provider|address|account/i);return {status:'ok',offers:[offer]};},now);
 assert.equal(calls,1);assert.equal(result.status,'synthetic-results');
 const row=result.offers[0];assert.equal(row.currentTotal,2136);assert.equal(row.alternativeTotal,1628);assert.equal(row.indicativeSaving,508);
 assert.deepEqual(row.source,offer.source);assert.equal(row.addressEligibility,'unverified');assert.equal(row.synthetic,true);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
test('expired, future and undated candidates fail even when retrieved recently',()=>{
 for(const change of [{activeUntil:'2026-11-23'},{activeFrom:'2026-11-25'},{activeFrom:undefined},{activeUntil:undefined},{source:{...offer.source,checkedOn:'2026-11-25'}}]) assert.equal(assessBroadbandFixture(bill,{...offer,...change},requirements,now),null);
});
test('savings need explicit like-for-like confirmation, complete terms and same currency',()=>{
 for(const change of [{equivalenceConfirmed:false},{featuresMatch:false},{speedMbps:67},{feesComplete:false},{priceChangesComplete:false}]) assert.equal(assessBroadbandFixture(bill,{...offer,...change},requirements,now).indicativeSaving,null);
 assert.equal(assessBroadbandFixture({...bill,details:{...bill.details,currency:'USD'}},offer,requirements,now).indicativeSaving,null);
 for(const change of [{oneOffFee:undefined},{periods:[{months:12,monthly:'65'}]},{periods:[{months:24,monthly:'unknown'}]}]) assert.equal(assessBroadbandFixture(bill,{...offer,...change},requirements,now),null);
});
test('address eligibility needs separate dated support, never a generic search hit',()=>{
 assert.equal(assessBroadbandFixture(bill,offer,requirements,now).addressEligibility,'unverified');
 const supported={...offer,eligibilityEvidence:{url:'https://eligibility.provider.example/fictional-check',checkedOn:'2026-11-24'}};
 assert.equal(assessBroadbandFixture(bill,supported,requirements,now).addressEligibility,'separately-supported');
 assert.equal(assessBroadbandFixture(bill,{...supported,eligibilityEvidence:{...supported.eligibilityEvidence,checkedOn:'2026-11-25'}},requirements,now).addressEligibility,'unverified');
});
test('quota exhaustion falls back after one call, with no retry, billing or network implementation',async()=>{
 let calls=0;const before=structuredClone(bill);
 const result=await compareBroadbandFixture(bill,requirements,async()=>{calls++;return {status:'quota_exhausted',offers:[offer]};},now);
 assert.equal(calls,1);assert.deepEqual(result,{status:'manual',reason:'quota-exhausted',offers:[]});assert.deepEqual(bill,before);
 assert.equal((await compareBroadbandFixture(bill,requirements,undefined,now)).status,'manual');
});
