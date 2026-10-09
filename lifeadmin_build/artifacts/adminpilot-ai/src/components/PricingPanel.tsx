import { useEffect, useState } from "react";
import { useProducts } from "@/hooks/use-api";
import { getBuyerId, getBuyerEmail, saveBuyerEmail } from "@/lib/auth";
import { toast } from "sonner";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function PricingPanel() {
  const buyerId = getBuyerId();
  const { data: productsData, isLoading: productsLoading, isError: productsError, refetch: retryProducts } = useProducts(buyerId);
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState<"GBP" | "USD">(() => typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("en-us") ? "USD" : "GBP");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setEmail(getBuyerEmail());
  }, []);

  const handleCheckout = async (productId: string) => {
    if (email) saveBuyerEmail(email);
    setLoadingId(productId);
    trackEvent("checkout_started", { product: productId });

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, user_id: buyerId, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Checkout is unavailable right now.");
      if (!data.url) throw new Error("Checkout is unavailable right now.");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Checkout is unavailable right now.");
    } finally {
      setLoadingId(null);
    }
  };

  if (productsLoading) {
    return (
      <section id="addons" aria-labelledby="pricing-heading" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
        <h2 id="pricing-heading" className="text-3xl font-extrabold text-slate-900">Simple one-time pricing</h2>
        <div role="status" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Loading pricing options...
        </div>
      </section>
    );
  }

  if (productsError || !productsData) {
    return (
      <section id="addons" aria-labelledby="pricing-heading" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
        <h2 id="pricing-heading" className="text-3xl font-extrabold text-slate-900">Simple one-time pricing</h2>
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="font-bold">Pricing could not be loaded.</p>
          <p className="mt-1 text-sm">Check your connection and try again. No purchase has been started.</p>
          <button type="button" onClick={() => void retryProducts()} className="mt-4 min-h-[44px] rounded-xl border border-amber-300 bg-white px-4 py-2 font-bold hover:bg-amber-100">
            Retry pricing
          </button>
        </div>
      </section>
    );
  }

  const { core, purchases, payments_live, stripe_configured } = productsData;
  const completeUnlocked = !!purchases?.core_app || !!purchases?.all_access;
  const paymentsLive = payments_live ?? stripe_configured ?? false;
  const displayPrice = currency === "GBP" ? "£1.99" : "$1.99";

  return (
    <section id="addons" aria-labelledby="pricing-heading" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
      <div className="max-w-3xl mb-10">
        <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">One price. Everything included.</p>
        <h2 id="pricing-heading" className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Try it free. Unlock everything for one small payment.</h2>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="font-semibold text-slate-700">Show prices in</span>
          <div role="group" aria-label="Display currency" className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
            <button type="button" aria-pressed={currency === "GBP"} onClick={() => setCurrency("GBP")} className={`rounded-lg px-4 py-2 font-bold ${currency === "GBP" ? "bg-primary text-white" : "text-slate-700"}`}>UK · GBP (£)</button>
            <button type="button" aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")} className={`rounded-lg px-4 py-2 font-bold ${currency === "USD" ? "bg-primary text-white" : "text-slate-700"}`}>US · USD ($)</button>
          </div>
        </div>
        <p className="text-lg text-slate-600"><strong>{displayPrice} once.</strong> All planning features included, with no subscription or upgrade fee.</p>
        <p className="mt-3 text-sm text-slate-500">The selector shows advertised UK/US prices, not a guaranteed checkout currency. Your final price and currency are confirmed before payment. Other countries: check checkout pricing.</p>
      </div>

      {!paymentsLive && !completeUnlocked && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 font-medium">
          Payments are not live yet. You are viewing the complete product in preview mode.
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <PriceCard
          name="LifeAdmin AI Complete"
          price={displayPrice}
          description="Everything you need to understand bills, reduce costs, negotiate, switch, cancel and challenge charges. You review and approve every action."
          features={["12 household bill categories and 7 goals", "Personalised action plans and provider-ready messages", "Advanced negotiation and cost-reduction guidance", "Switching, renewal and cancellation support", "Complaints, refunds and escalation assistance", "Save and revisit plans with an account", "No subscription and no separate upgrade"]}
          unlocked={completeUnlocked}
          highlighted
          disabled={completeUnlocked || !core.checkout_ready || loadingId === "core_app"}
          buttonLabel={completeUnlocked ? "Complete access unlocked" : loadingId === "core_app" ? "Opening checkout..." : !core.checkout_ready ? "Payments not live yet" : "Unlock everything"}
          busy={loadingId === "core_app"}
          onClick={() => handleCheckout("core_app")}
        />
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 flex gap-3">
          <ShieldCheck aria-hidden="true" className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <strong className="block text-slate-900">Receipt email is optional</strong>
            <span className="text-sm text-slate-600">If checkout is live, enter an email only if you want Stripe to prefill it.</span>
          </div>
        </div>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email for receipt"
          className="w-full md:max-w-sm bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </section>
  );
}

function PriceCard({ name, price, description, features, unlocked, disabled, buttonLabel, busy, onClick, highlighted = false }: {
  name: string;
  price: string;
  description: string;
  features: string[];
  unlocked: boolean;
  disabled: boolean;
  buttonLabel: string;
  busy: boolean;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <div className={`relative p-6 md:p-7 rounded-2xl border shadow-sm ${highlighted ? "bg-slate-900 border-slate-800 text-white" : unlocked ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      {highlighted && <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-cyan-400/15 text-cyan-200 text-xs font-bold">Everything included</span>}
      <div className="flex items-start justify-between gap-3 mb-4 pr-16">
        <h3 className={`text-xl font-extrabold flex items-center gap-2 ${highlighted ? "text-white" : "text-slate-900"}`}>
          {name} {unlocked ? <Check aria-hidden="true" className="text-emerald-500 w-5 h-5" /> : <Lock aria-hidden="true" className={highlighted ? "text-slate-400 w-4 h-4" : "text-slate-400 w-4 h-4"} />}
        </h3>
        <span className={`text-sm font-bold whitespace-nowrap ${highlighted ? "text-cyan-200" : "text-primary"}`}>{unlocked ? "Owned" : price}</span>
      </div>
      <p className={`text-sm leading-relaxed mb-5 ${highlighted ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
      <ul className="space-y-2.5 mb-7">
        {features.map((feature) => (
          <li key={feature} className={`flex gap-2 text-sm font-medium ${highlighted ? "text-slate-200" : "text-slate-700"}`}><Check aria-hidden="true" className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> {feature}</li>
        ))}
      </ul>
      <button
        disabled={disabled}
        aria-busy={busy}
        onClick={onClick}
        className={`w-full min-h-[46px] py-3 rounded-xl font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${unlocked ? "bg-emerald-100 text-emerald-700" : highlighted ? "bg-white text-slate-900 hover:bg-blue-50" : "bg-primary hover:bg-blue-600 text-white"}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
