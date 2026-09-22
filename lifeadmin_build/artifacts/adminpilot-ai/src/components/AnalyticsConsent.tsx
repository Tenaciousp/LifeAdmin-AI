import { useEffect, useState } from "react";

const CONSENT_KEY = "lifeadmin_analytics_consent";

export function AnalyticsConsent() {
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    try {
      setChoice(localStorage.getItem(CONSENT_KEY));
    } catch {
      setChoice("denied");
    }
  }, []);

  const choose = (value: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
      window.dispatchEvent(new CustomEvent("lifeadmin:analytics-consent", { detail: value }));
    } catch {
      // Storage failure should not block product use.
    }
    setChoice(value);
  };

  if (choice) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5"
      role="dialog"
      aria-label="Analytics privacy choice"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-extrabold text-slate-900">Help improve LifeAdmin AI?</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Optional analytics can measure feature usage and conversions. Bill text, provider messages, addresses and account details are not included in analytics events.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="min-h-[44px] rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </aside>
  );
}

export function resetAnalyticsConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
    window.location.reload();
  } catch {
    // Ignore storage failures.
  }
}
