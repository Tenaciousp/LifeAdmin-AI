type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Privacy-light analytics bridge.
 *
 * The app never sends free-text bill details through this helper. Event names and
 * small categorical values can be consumed by Umami today and by GA4 / Google
 * Ads later when the owner adds the relevant production tags.
 */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("lifeadmin_analytics_consent") !== "granted") return;
  } catch {
    return;
  }
  const safeData = sanitizeAnalyticsData(data);

  try {
    window.umami?.track(name, safeData);
  } catch {
    // Analytics must never break the app.
  }

  try {
    window.gtag?.("event", name, safeData || {});
  } catch {
    // Ignore optional Google analytics failures.
  }

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...(safeData || {}) });
    }
  } catch {
    // Ignore optional tag-manager failures.
  }
}

function sanitizeAnalyticsData(data?: AnalyticsData): AnalyticsData | undefined {
  if (!data) return undefined;
  const safe: AnalyticsData = {};
  for (const [key, value] of Object.entries(data)) {
    if (/query|email|provider|description|notes|message|account|address/i.test(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 80);
    else safe[key] = value;
  }
  return Object.keys(safe).length ? safe : undefined;
}
