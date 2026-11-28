import type { WorkflowDraft } from "./bill-workflow.mjs";

type InAppFollowUpResult = {
  body: string;
  subject?: string;
  grounding?: WorkflowDraft["grounding"];
};

export function composeInAppFollowUp(input: {
  originalRequest: string;
  currentAnswer: string;
  followUpQuestion: string;
}): string;

export function requestInAppFollowUp(input: {
  prompt: string;
  output: string;
  method: "gemini_api" | "customer_api";
  provider: string;
  apiKey: string;
  liveComparison: boolean;
  generateDraft: (prompt: string, output: string) => Promise<InAppFollowUpResult>;
  generateComparison: (prompt: string) => Promise<InAppFollowUpResult>;
  generateCustomer: (prompt: string, output: string, provider: string, apiKey: string, search: boolean) => Promise<InAppFollowUpResult>;
}): Promise<InAppFollowUpResult>;

export function retainProviderEmail(current: {
  messageSubject?: string;
  messageBody?: string;
}, refreshed: {
  messageSubject: string;
  messageBody: string;
}): {
  messageSubject: string;
  messageBody: string;
};

export function runAndClearEphemeralInput<T>(operation: () => Promise<T>, clearInput: () => void): Promise<T>;
