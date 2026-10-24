export function aiDraftConfigured(): boolean;
export function generateWithGemini(prompt: string, output: string, fetchImpl?: typeof fetch): Promise<{ subject: string; body: string }>;
