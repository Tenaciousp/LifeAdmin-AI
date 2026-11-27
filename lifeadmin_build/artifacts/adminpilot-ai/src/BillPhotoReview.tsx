import {useState} from 'react';
import {confirmBillReview} from './lib/offline/bill-intake.mjs';
import type {IntakeFields} from './lib/offline/bill-intake.mjs';

// Receives allowlisted candidates only. The capture/recognition caller must discard raw inputs.
export default function BillPhotoReview({candidates,onApply,onCancel}:{candidates:IntakeFields;onApply:(fields:ReturnType<typeof confirmBillReview>)=>void;onCancel:()=>void}) {
  const [fields,setFields]=useState<IntakeFields>({...candidates});
  const [confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState('');
  const labels:Record<keyof IntakeFields,string>={provider:'Provider',amount:'Monthly amount (GBP)',contract_end_date:'Contract end date',one_off_fee:'Separate one-off fee (GBP)'};
  return <form aria-label="Review extracted bill details" onSubmit={event=>{event.preventDefault();try {onApply(confirmBillReview(fields,confirmed));}catch {setError('Check every field and confirm your review before applying.');}}}>
    <h2 className="text-xl font-bold">Check the bill details</h2>
    <p>Check each value against your bill. Blank fields need manual entry. Account references and the original image or text are excluded. Applying these details fills the bill form; use its save action to store the bill.</p>
    {(Object.keys(labels) as (keyof IntakeFields)[]).map(key=><label className="mt-3 block" key={key}>{labels[key]}<input className="mt-1 min-h-[44px] w-full rounded-xl border p-3" type={key==='contract_end_date'?'date':'text'} inputMode={key==='amount'||key==='one_off_fee'?'decimal':undefined} maxLength={80} value={fields[key]} onChange={event=>{setFields({...fields,[key]:event.target.value});setConfirmed(false);setError('');}} /></label>)}
    <label className="mt-3 flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />I checked the provider, monthly amount, end date and separate fee.</label>
    {error && <p role="alert">{error}</p>}
    <button className="min-h-[44px] rounded-xl bg-violet-700 p-3 text-white" disabled={!confirmed}>Apply reviewed details to bill form</button>
    <button className="min-h-[44px] p-3" type="button" onClick={onCancel}>Cancel and enter manually</button>
  </form>;
}
