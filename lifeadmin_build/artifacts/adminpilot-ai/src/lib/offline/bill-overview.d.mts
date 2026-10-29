export const countries: string[];
export const currencies: string[];
export const frequencies: string[];
export function recurringCost(task: any): { currency: string; amount: number; monthly: number; yearly: number } | null;
export function money(amount: number, currency: string): string;
export function billOverview(tasks: any[], today?: string): { active: number; priced: number; unpriced: number; totals: {currency: string; monthly: number; yearly: number}[]; upcoming: {task: any; kind: string; date: string; overdue: boolean}[] };

export function sortBills(tasks: any[], order?: string): any[];
