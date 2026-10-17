import type { LocalRecord, LocalStore } from "./storage.mjs";
export function normaliseTask(task: Record<string, unknown>): any;
export function missingDetails(task: Record<string, unknown>): string[];
export function safetyNotices(task: Record<string, unknown>): string[];
export function generateLocalResult(task: Record<string, unknown>, mode?: string): any;
export function generateAndSaveLocalPlan(store: LocalStore, taskId: string, mode?: string): Promise<LocalRecord>;
export function planTextForCopy(plan: Record<string, unknown>): string;
export function manualAiPrompt(plan: Record<string, unknown>): string;

