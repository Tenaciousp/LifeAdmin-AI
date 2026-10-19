export const aiServices: { id: string; name: string; url: string }[];
export const aiActions: { id: string; label: string; request: string }[];
export function promptFields(plan: Record<string, any>): { key: string; label: string; value: string; selected: boolean }[];
export function preferredAi(storage?: Storage | null): string;
export function savePreferredAi(storage: Storage | null, id: string): void;
export function taskAiPrompt(plan: Record<string, any>, options?: { action?: string; fieldKeys?: string[]; includeDraft?: boolean }): string;
