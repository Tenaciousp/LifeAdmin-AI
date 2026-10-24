import { Capacitor, CapacitorHttp } from "@capacitor/core";

const configuredBase = String(import.meta.env?.VITE_AI_DRAFT_API_BASE_URL || "").replace(/\/+$/, "");

export function aiDraftConfigured() {
  // The hosted web app uses its same-origin API. Native packages need an
  // explicitly configured HTTPS API base so no household details hit localhost.
  return !Capacitor.isNativePlatform() || /^https:\/\//i.test(configuredBase);
}

function endpoint() {
  if (Capacitor.isNativePlatform() && !/^https:\/\//i.test(configuredBase)) {
    throw new Error("In-app Gemini is not configured for this version. Use Copilot or an offline draft.");
  }
  return `${configuredBase}/api/ai/draft`;
}

/** Send a reviewed prompt to HomeAdmin's server-side Gemini proxy. No provider
 * credential is included in the app; generation never saves or logs the prompt.
 */
export async function generateWithGemini(prompt, output, fetchImpl = globalThis.fetch) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000) {
    throw new Error("Review a request of up to 20,000 characters before generating.");
  }
  if (!["plan", "letter", "reply"].includes(output)) throw new Error("Choose a plan, letter or reply.");
  const url = endpoint();
  const data = { prompt, output, consent: true };
  let status;
  let payload;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.post({
        url,
        headers: { "Content-Type": "application/json" },
        data,
        connectTimeout: 10000,
        readTimeout: 60000,
      });
      status = response.status;
      payload = response.data;
    } else {
      if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        status = response.status;
        payload = await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (failure) {
    if (failure instanceof Error && /not configured/.test(failure.message)) throw failure;
    throw new Error("Could not reach HomeAdmin's AI service. Check your connection and try again.");
  }
  if (status === 503) throw new Error("In-app Gemini is not available yet. Use Copilot or an offline draft.");
  if (status === 429) throw new Error("The AI service has reached its current usage limit. Try again later or use Copilot.");
  if (status < 200 || status >= 300) throw new Error("Gemini could not generate a draft. Try again or use Copilot.");
  if (typeof payload?.subject !== "string" || typeof payload?.body !== "string" || !payload.body.trim() || payload.subject.length > 200 || payload.body.length > 20000) {
    throw new Error("Gemini returned an incomplete draft. Try again or use Copilot.");
  }
  return { subject: payload.subject.trim(), body: payload.body.trim() };
}
