import { Capacitor, CapacitorHttp } from "@capacitor/core";

const configuredBase = String(import.meta.env?.VITE_AI_DRAFT_API_BASE_URL || "").replace(/\/+$/, "");

export function aiDraftConfigured() {
  // The hosted web app uses its same-origin API. Native packages need an
  // explicitly configured HTTPS API base so no household details hit localhost.
  return !Capacitor.isNativePlatform() || /^https:\/\//i.test(configuredBase);
}

/** Availability checks contain no bill details and never generate a draft. */
export async function aiDraftAvailable(fetchImpl = globalThis.fetch) {
  if (!aiDraftConfigured()) return false;
  try {
    let status, payload;
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({ url: `${configuredBase}/api/health`, connectTimeout: 5000, readTimeout: 5000 });
      status = response.status; payload = response.data;
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetchImpl(`${configuredBase}/api/health`, { credentials: "omit", signal: controller.signal });
        status = response.status; payload = await response.json();
      } finally { clearTimeout(timeout); }
    }
    return status === 200 && payload?.ai_drafts_available === true;
  } catch { return false; }
}

export async function liveComparisonAvailable(fetchImpl = globalThis.fetch) {
  if (!aiDraftConfigured()) return false;
  try {
    let status, payload;
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({ url: `${configuredBase}/api/health`, connectTimeout: 5000, readTimeout: 5000 });
      status = response.status; payload = response.data;
    } else {
      if (typeof fetchImpl !== "function") return false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetchImpl(`${configuredBase}/api/health`, { credentials: "omit", signal: controller.signal });
        status = response.status; payload = await response.json();
      } finally { clearTimeout(timeout); }
    }
    return status === 200 && payload?.live_comparisons_available === true;
  } catch { return false; }
}

export async function customerKeyAiAvailable(fetchImpl = globalThis.fetch) {
  if (!aiDraftConfigured()) return false;
  try {
    let status, payload;
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({ url: `${configuredBase}/api/health`, connectTimeout: 5000, readTimeout: 5000 });
      status = response.status; payload = response.data;
    } else {
      if (typeof fetchImpl !== "function") return false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetchImpl(`${configuredBase}/api/health`, { credentials: "omit", signal: controller.signal });
        status = response.status; payload = await response.json();
      } finally { clearTimeout(timeout); }
    }
    return status === 200 && payload?.customer_key_ai_available === true;
  } catch { return false; }
}

function apiBase() {
  if (Capacitor.isNativePlatform() && !/^https:\/\//i.test(configuredBase)) {
    throw new Error("In-app AI is not configured for this version. Use Copilot or an offline draft.");
  }
  return configuredBase;
}

function endpoint() {
  return `${apiBase()}/api/ai/draft`;
}

function safeSource(item) {
  if (!item || typeof item.title !== "string" || typeof item.url !== "string") return false;
  try {
    const url = new URL(item.url);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
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
  if (status === 503) throw new Error("In-app AI is not available yet. Use Copilot or an offline draft.");
  if (status === 429) throw new Error("The AI service has reached its current usage limit. Try again later or use Copilot.");
  if (status < 200 || status >= 300) throw new Error("Gemini could not generate a draft. Try again or use Copilot.");
  if (typeof payload?.subject !== "string" || typeof payload?.body !== "string" || !payload.body.trim() || payload.subject.length > 200 || payload.body.length > 20000) {
    throw new Error("Gemini returned an incomplete draft. Try again or use Copilot.");
  }
  return { subject: payload.subject.trim(), body: payload.body.trim() };
}

/** Submit a reviewed comparison request. The backend returns a grounded result,
 * citation metadata and Google's Search Suggestion HTML for the required display.
 */
export async function generateLiveComparison(prompt, fetchImpl = globalThis.fetch) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000) {
    throw new Error("Review a request of up to 20,000 characters before searching.");
  }
  const base = apiBase();
  let status, payload;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.post({
        url: `${base}/api/ai/comparison`,
        headers: { "Content-Type": "application/json" },
        data: { prompt, consent: true },
        connectTimeout: 10000,
        readTimeout: 90000,
      });
      status = response.status; payload = response.data;
    } else {
      if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      try {
        const response = await fetchImpl(`${base}/api/ai/comparison`, {
          method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, consent: true }), signal: controller.signal,
        });
        status = response.status; payload = await response.json();
      } finally { clearTimeout(timeout); }
    }
  } catch (failure) {
    if (failure instanceof Error && /not configured/.test(failure.message)) throw failure;
    throw new Error("Could not reach HomeAdmin's live research service. Your request remains available.");
  }
  if (status === 503) throw new Error("Live offer research is not enabled for this version. Use your preferred AI or an offline draft.");
  if (status === 429) throw new Error("Live research has reached its current usage limit. Try later or use your preferred AI.");
  if (status < 200 || status >= 300) throw new Error(payload?.error || "A sourced comparison could not be completed. Your request remains available.");
  if (typeof payload?.body !== "string" || !payload.body.trim() || payload.body.length > 20000 ||
      !Array.isArray(payload.sources) || payload.sources.length === 0 ||
      typeof payload.search_suggestions_html !== "string" || !payload.search_suggestions_html.trim() || payload.search_suggestions_html.length > 20000 ||
      typeof payload.checked_at !== "string" || Number.isNaN(Date.parse(payload.checked_at))) {
    throw new Error("The research service returned no complete source evidence. No comparison was saved.");
  }
  const sources = payload.sources.filter(safeSource).slice(0, 20).map(item => ({ title: item.title.slice(0, 200), url: item.url.slice(0, 2000) }));
  if (!sources.length) throw new Error("The research service returned no valid HTTPS source links. No comparison was saved.");
  const citations = Array.isArray(payload.citations) ? payload.citations.slice(0, 100).flatMap(item => {
    if (!item || typeof item.claim !== "string" || !Array.isArray(item.sources)) return [];
    const linked = item.sources.filter(safeSource).slice(0, 5).map(source => ({ title: source.title.slice(0, 200), url: source.url.slice(0, 2000) }));
    return linked.length ? [{ claim: item.claim.slice(0, 1000), sources: linked }] : [];
  }) : [];
  return {
    body: payload.body,
    grounding: {
      sources,
      citations,
      search_suggestions_html: payload.search_suggestions_html,
      checked_at: payload.checked_at,
      model: typeof payload.model === "string" ? payload.model : "",
    },
  };
}

/** Send one user-approved request and API key through the HTTPS HomeAdmin relay.
 * Neither is persisted. Provider charges and processing follow the customer's account.
 */
export async function generateCustomerAi(prompt, output, provider, apiKey, search = false, fetchImpl = globalThis.fetch) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20000) throw new Error("Review a request of up to 20,000 characters before generating.");
  if (!["plan", "letter", "reply"].includes(output)) throw new Error("Choose a plan, letter or reply.");
  if (!["openai", "gemini", "anthropic"].includes(provider)) throw new Error("Choose a supported AI provider.");
  if (typeof apiKey !== "string" || apiKey.length < 10 || apiKey.length > 512) throw new Error("Enter your provider API key.");
  const url = `${apiBase()}/api/ai/customer`;
  const data = { prompt, output, provider, search: search === true, consent: true };
  let status, payload;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.post({
        url, headers: { "Content-Type": "application/json", "X-Customer-Provider-Key": apiKey }, data,
        connectTimeout: 10000, readTimeout: 100000,
      });
      status = response.status; payload = response.data;
    } else {
      if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 100000);
      try {
        const response = await fetchImpl(url, {
          method: "POST", credentials: "omit",
          headers: { "Content-Type": "application/json", "X-Customer-Provider-Key": apiKey },
          body: JSON.stringify(data), signal: controller.signal,
        });
        status = response.status; payload = await response.json();
      } finally { clearTimeout(timeout); }
    }
  } catch (failure) {
    if (failure instanceof Error && /not configured/.test(failure.message)) throw failure;
    throw new Error("Could not reach HomeAdmin's secure AI relay. Your request remains here; retry or use your preferred AI handoff.");
  }
  if (status === 503) throw new Error("Customer-key AI is not enabled for this version. Use your preferred AI handoff.");
  if (status === 401) throw new Error(payload?.error || "The provider rejected this API key. Check the key and API access.");
  if (status === 429) throw new Error(payload?.error || "The provider reached its usage limit. Check its billing and limits.");
  if (status < 200 || status >= 300) throw new Error(payload?.error || "The provider could not complete this request. Your request remains here.");
  if (typeof payload?.body !== "string" || !payload.body.trim() || payload.body.length > 20000) throw new Error("The provider returned an incomplete answer. No result was saved.");
  let grounding = null;
  if (search) {
    if (!Array.isArray(payload.sources) || !payload.sources.length || typeof payload.checked_at !== "string" || Number.isNaN(Date.parse(payload.checked_at))) {
      throw new Error("No dated source evidence came back. No live comparison was saved.");
    }
    const sources = payload.sources.filter(safeSource).slice(0, 20).map(item => ({ title: item.title.slice(0, 200), url: item.url.slice(0, 2000) }));
    if (!sources.length) throw new Error("The provider returned no valid HTTPS sources. No live comparison was saved.");
    const citations = Array.isArray(payload.citations) ? payload.citations.slice(0, 100).flatMap(item => {
      if (!item || typeof item.claim !== "string" || !Array.isArray(item.sources)) return [];
      const linked = item.sources.filter(safeSource).slice(0, 5).map(source => ({ title: source.title.slice(0, 200), url: source.url.slice(0, 2000) }));
      return linked.length ? [{ claim: item.claim.slice(0, 1000), sources: linked }] : [];
    }) : [];
    grounding = { sources, citations, checked_at: payload.checked_at, model: String(payload.model || "").slice(0, 100), provider, search_suggestions_html: String(payload.search_suggestions_html || "").slice(0, 20000) };
  }
  return { body: payload.body, grounding, model: typeof payload.model === "string" ? payload.model : "" };
}
