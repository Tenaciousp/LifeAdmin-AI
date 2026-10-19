export const diaryDates = [
  { id: 'contract_expiry', label: 'Contract expiry' },
  { id: 'renewal_date', label: 'Renewal date' },
  { id: 'notice_deadline', label: 'Cancellation notice deadline' },
  { id: 'follow_up_date', label: 'Follow-up date' },
];
export function validDiaryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31') return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function diaryEvents(tasks) {
  const events = [];
  const ids = new Set();
  for (const task of tasks) {
    if (task.details?.diary_enabled !== 'yes' || task.status === 'Done') continue;
    if (typeof task.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(task.id) || ids.has(task.id)) throw new Error('A bill identifier is invalid or duplicated. Diary entries were not updated.');
    ids.add(task.id);
    const leadDays = Number(task.details.diary_lead_days ?? '14');
    if (![0, 7, 14, 30].includes(leadDays)) throw new Error('Choose a diary reminder of 0, 7, 14 or 30 days.');
    for (const field of diaryDates) {
      const date = task.details[field.id];
      if (!date) continue;
      if (!validDiaryDate(date)) throw new Error('Check the ' + field.label.toLowerCase() + ' date. Diary entries were not updated.');
      events.push({ key: task.id + '/' + field.id, title: 'LifeAdmin: ' + field.label, date, leadDays });
    }
  }
  if (events.length > 1000) throw new Error('Diary integration supports up to 1,000 dated entries. Disable diary entries for older bills before retrying.');
  return events;
}
