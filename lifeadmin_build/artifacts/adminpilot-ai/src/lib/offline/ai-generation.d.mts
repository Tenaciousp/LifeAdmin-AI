export function aiDraftConfigured(): boolean;
export function generateWithGemini(prompt: string, output: string, fetchImpl?: typeof fetch): Promise<{ subject: string; body: string }>;

export function aiDraftAvailable(fetchImpl?: typeof fetch): Promise<boolean>;
export function liveComparisonAvailable(fetchImpl?: typeof fetch): Promise<boolean>;
export function customerKeyAiAvailable(fetchImpl?: typeof fetch): Promise<boolean>;
export function generateCustomerAi(prompt: string, output: string, provider: string, apiKey: string, search?: boolean, fetchImpl?: typeof fetch): Promise<{ body: string; grounding: { sources: { title: string; url: string }[]; citations: { claim: string; sources: { title: string; url: string }[] }[]; search_suggestions_html: string; checked_at: string; model: string; provider: string } | null; model: string }>;
export function generateLiveComparison(prompt: string, fetchImpl?: typeof fetch): Promise<{ body: string; grounding: { sources: { title: string; url: string }[]; citations: { claim: string; sources: { title: string; url: string }[] }[]; search_suggestions_html: string; checked_at: string; model: string } }>;
