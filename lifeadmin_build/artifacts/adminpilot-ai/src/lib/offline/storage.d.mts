export type LocalRecord = { id: string; title: string; [key: string]: any };
export type MessageDraft = { subject: string; body: string; kind?: string };
export type LocalStore = {
 close(): void;
 read(): Promise<{ tasks: LocalRecord[]; plans: LocalRecord[] }>;
 createTask(task: LocalRecord): Promise<unknown>;
 updateTask(id: string, changes: Record<string, unknown>): Promise<unknown>;
 savePlan(plan: LocalRecord): Promise<unknown>;
 saveWorkflowProgress(id: string, draft: Record<string, any>, expectedDraft?: Record<string, any> | null): Promise<unknown>;
 saveWorkflowResult(plan: LocalRecord, expectedDraft?: Record<string, any> | null): Promise<unknown>;
 updatePlanMessage(id: string, draft: MessageDraft, expected: MessageDraft): Promise<LocalRecord>;
 deleteTask(id: string): Promise<unknown>;
 deletePlan(id: string): Promise<unknown>;
 clear(): Promise<unknown>;
 exportBackup(): Promise<string>;
 importBackup(text: string, options: { replace: boolean }): Promise<unknown>;
};
export function openLocalStore(options?: { indexedDB?: IDBFactory; name?: string }): Promise<LocalStore>;


export function parseBackup(text: string): { tasks: LocalRecord[]; plans: LocalRecord[] };
export function serialise(snapshot: { tasks: LocalRecord[]; plans: LocalRecord[] }): string;
export function record(value: unknown, kind: string): LocalRecord;
export function jsonValue(value: unknown): void;
export function planWithEditedMessage(plan: LocalRecord | undefined, draft: MessageDraft, expected: MessageDraft): LocalRecord;
export function assertWorkflowCurrent(task: LocalRecord, expected: unknown): void;

