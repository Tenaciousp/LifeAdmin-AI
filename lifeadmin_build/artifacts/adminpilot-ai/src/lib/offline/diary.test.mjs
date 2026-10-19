import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaryEvents, validDiaryDate } from './diary.mjs';
import { openLocalStore } from './storage.mjs';
import { IDBFactory } from 'fake-indexeddb';
const task = { id: 'sample-1', title: 'PRIVATE PROVIDER', status: 'Open', notes: 'PRIVATE NOTES', details: { provider: 'PRIVATE NAME', account_reference: 'PRIVATE REF', diary_enabled: 'yes', diary_lead_days: '14', contract_expiry: '2028-02-29', renewal_date: '2028-03-01', notice_deadline: '2028-02-01', follow_up_date: '2028-02-05', next_payment_date: '2028-01-01' } };
test('diary uses four distinct contract dates, stable keys and neutral titles without personal details', () => {
  const before = structuredClone(task), events = diaryEvents([task]);
  assert.equal(events.length, 4); assert.equal(new Set(events.map(x => x.key)).size, 4);
  assert.equal(events[0].date, '2028-02-29'); assert.equal(events[0].leadDays, 14);
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE|2028-01-01/);
  assert.deepEqual(diaryEvents([structuredClone(task)]), events); assert.deepEqual(task, before);
});
test('completed and disabled bills produce no desired entries; old payment dates are not guessed as expiry', () => {
  assert.deepEqual(diaryEvents([{...task, status:'Done'}]), []);
  assert.deepEqual(diaryEvents([{...task, details:{...task.details, diary_enabled:'no'}}]), []);
  assert.deepEqual(diaryEvents([{id:'old', title:'Older bill', details:{date:'2028-01-01', minimum_term_end:'2028-02-01'}}]), []);
});
test('invalid or duplicated enabled entries fail before any calendar work', () => {
  for (const day of ['2027-02-29','2028-02-30','2028-13-01','2028-04-31','2028-2-01','not-a-date','1899-01-01','2200-01-01']) {
    assert.equal(validDiaryDate(day), false, day);
    assert.throws(() => diaryEvents([{...task, details:{...task.details, contract_expiry:day}}]), /Check the contract expiry/);
  }
  assert.equal(validDiaryDate('2028-03-26'), true); assert.equal(validDiaryDate('2028-10-29'), true);
  assert.throws(() => diaryEvents([task,task]), /duplicated/);
  assert.throws(() => diaryEvents([{...task, details:{...task.details, diary_lead_days:'-1'}}]), /Choose a diary/);
  assert.throws(() => diaryEvents([{...task, id:'invalid/identifier'}]), /identifier/);
});
test('date edits keep event identity and backup restore preserves dates without device calendar links', async () => {
  const store=await openLocalStore({indexedDB:new IDBFactory(),name:'diary-test'});
  await store.createTask(task); const backup=await store.exportBackup();
  await store.updateTask(task.id,{details:{...task.details,contract_expiry:'2028-04-01',notice_deadline:''}});
  const changed=diaryEvents((await store.read()).tasks);
  assert.equal(changed.length,3); assert.equal(changed[0].key,'sample-1/contract_expiry');assert.equal(changed[0].date,'2028-04-01');
  await store.importBackup(backup,{replace:true});assert.deepEqual(diaryEvents((await store.read()).tasks),diaryEvents([task]));
  assert.doesNotMatch(backup,/calendarId|eventIdentifier|Managed by/);store.close();
});
