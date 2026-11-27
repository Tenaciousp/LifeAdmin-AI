export type IntakeFields = {provider:string; amount:string; contract_end_date:string; one_off_fee:string};
export function intakeDate(value: unknown): string;
export function mapBillText(result: unknown): {status:'manual'|'review';fields:IntakeFields;issues:string[]};
export function confirmBillReview(fields: IntakeFields, confirmed: boolean): IntakeFields & {currency:'GBP';billing_frequency:'Monthly'};
export function applyReviewedBill(existing: Record<string,string>, fields: IntakeFields, confirmed: boolean): Record<string,string>;
