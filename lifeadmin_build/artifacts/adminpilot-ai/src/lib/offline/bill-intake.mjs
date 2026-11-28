// On-device OCR boundary. Return only reviewed-field candidates, never OCR text or identifiers.
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function intakeDate(value) {
  if (typeof value !== 'string') return '';
  let iso = value.trim();
  const written = iso.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
  if (written) {
    const month = months.findIndex(name => name.toLowerCase() === written[2].toLowerCase());
    if (month < 0) return '';
    iso = `${written[3]}-${String(month+1).padStart(2,'0')}-${written[1].padStart(2,'0')}`;
  }
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(iso)) return '';
  const date = new Date(iso+'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === iso ? iso : '';
}
const amount = value => typeof value === 'string' && /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value.trim()) ? Number(value).toFixed(2) : '';
const provider = value => typeof value === 'string' && /^[A-Za-z][A-Za-z &.'()-]{1,79}$/.test(value.trim()) && !/account|reference|password|address|email/i.test(value) ? value.trim() : '';
const blank = () => ({provider:'', amount:'', contract_end_date:'', one_off_fee:''});
export function mapBillText(result) {
  if (result?.status !== 'recognized' || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 20000) return {status:'manual', fields:blank(), issues:['Enter the bill manually.']};
  const candidates = {provider:[], amount:[], contract_end_date:[], one_off_fee:[]};
  for (const line of result.text.split(/\r?\n/)) {
    const match = line.trim().match(/^(Provider|Monthly price|Contract end date|One-off fee):\s*(.+)$/i);
    if (!match) continue;
    const label = match[1].toLowerCase(), value = match[2].trim();
    if (label === 'provider') candidates.provider.push(provider(value));
    if (label === 'monthly price') candidates.amount.push(/^£/.test(value) ? amount(value.slice(1)) : '');
    if (label === 'one-off fee') candidates.one_off_fee.push(/^£/.test(value) ? amount(value.slice(1)) : '');
    if (label === 'contract end date') candidates.contract_end_date.push(intakeDate(value));
  }
  const fields = blank(), issues=[];
  for (const key of Object.keys(fields)) {
    const values = candidates[key];
    fields[key] = values.length && values.every(value => value && value === values[0]) ? values[0] : '';
    if (!fields[key]) issues.push(`Check ${key.replaceAll('_',' ')} manually.`);
  }
  return { status:Object.values(fields).some(Boolean) ? 'review' : 'manual', fields, issues };
}
export function confirmBillReview(fields, confirmed) {
  if (confirmed !== true) throw new Error('Confirm the reviewed values before applying them.');
  const safe = {provider:provider(fields?.provider), amount:amount(fields?.amount), contract_end_date:intakeDate(fields?.contract_end_date), one_off_fee:amount(fields?.one_off_fee)};
  if (!safe.provider || !safe.amount || !safe.contract_end_date || !safe.one_off_fee) throw new Error('Check the provider, monthly amount, end date and separate one-off fee. Enter 0 for no fee.');
  return {...safe, currency:'GBP', billing_frequency:'Monthly'};
}

// Apply only reviewed values to an unsaved form; preserve unrelated user-entered fields.
export function applyReviewedBill(existing, fields, confirmed) {
  const safe = confirmBillReview(fields, confirmed);
  return {...existing, provider:safe.provider, amount:safe.amount, currency:safe.currency,
    billing_frequency:safe.billing_frequency, contract_expiry:safe.contract_end_date, one_off_fee:safe.one_off_fee};
}
