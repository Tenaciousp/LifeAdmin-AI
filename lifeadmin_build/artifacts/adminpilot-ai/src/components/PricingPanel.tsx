import { useEffect, useState } from "react";
import { useProducts } from "@/hooks/use-api";
import { getBuyerId, getBuyerEmail, saveBuyerEmail } from "@/lib/auth";
import { toast } from "sonner";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function PricingPanel() {
  const buyerId = getBuyerId();
  const { data: productsData } = useProducts(buyerId);
  const [email, setEmail] = useState("");
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

  if (!productsData) return null;

  const { core, addons, purchases, payments_live, stripe_configured } = productsData;
  const coreUnlocked = !!purchases?.core_app;
  const allAccessUnlocked = !!purchases?.all_access;
  const paymentsLive = payments_live ?? stripe_configured ?? false;

  return (
    <section id="addons" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
      <div className="max-w-3xl mb-10">
        <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">Simple one-time pricing</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Start for 99p/99c. Unlock everything for £2.98/$2.98 total.</h2>
        <p className="text-lg text-slate-600">Core is 99p/99c once. All Access is an additional £1.99/$1.99 once. No subscription. Equivalent local store pricing applies where supported.</p>
      </div>

      {!paymentsLive && !coreUnlocked && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 font-medium">
          Payments are not live yet. You are viewing the complete product in preview mode.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <PriceCard
          name={core.name}
          price={core.price}
          description="Household-bill plans, next steps, provider messages, things to check and approval checklists."
          features={["12 household categories", "7 practical goals", "Provider-ready messages", "Unknown-payment journey", "Manual AI handoff"]}
          unlocked={coreUnlocked}
          disabled={coreUnlocked || !core.checkout_ready || loadingId === "core_app"}
          buttonLabel={coreUnlocked ? "Core unlocked" : loadingId === "core_app" ? "Opening checkout..." : !core.checkout_ready ? "Payments not live yet" : "Get Core"}
          onClick={() => handleCheckout("core_app")}
        />

        {(addons || []).map((addon: any) => {
          const unlocked = !!purchases?.[addon.id];
          const needsCore = !coreUnlocked && addon.id === "all_access";
          return (
            <PriceCard
              key={addon.id}
              name={addon.name}
              price={addon.price}
              description="Advanced negotiation support, complaint and escalation help, switching guidance, comparison prompts and deeper provider messages."
              features={["Everything in Core", "Advanced negotiation plans", "Complaint & escalation support", "Switching and comparison guidance", "Advanced planning modes"]}
              unlocked={unlocked}
              highlighted
              disabled={unlocked || needsCore || !addon.checkout_ready || loadingId === addon.id}
              buttonLabel={unlocked ? "All Access unlocked" : loadingId === addon.id ? "Opening checkout..." : needsCore ? "Get Core first" : !addon.checkout_ready ? "Payments not live yet" : "Unlock All Access"}
              onClick={() => handleCheckout(addon.id)}
            />
          );
        })}
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 flex gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
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

function PriceCard({ name, price, description, features, unlocked, disabled, buttonLabel, onClick, highlighted = false }: {
  name: string;
  price: string;
  description: string;
  features: string[];
  unlocked: boolean;
  disabled: boolean;
  buttonLabel: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <div className={`relative p-6 md:p-7 rounded-2xl border shadow-sm ${highlighted ? "bg-slate-900 border-slate-800 text-white" : unlocked ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      {highlighted && <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-cyan-400/15 text-cyan-200 text-xs font-bold">Best value</span>}
      <div className="flex items-start justify-between gap-3 mb-4 pr-16">
        <h3 className={`text-xl font-extrabold flex items-center gap-2 ${highlighted ? "text-white" : "text-slate-900"}`}>
          {name} {unlocked ? <Check className="text-emerald-500 w-5 h-5" /> : <Lock className={highlighted ? "text-slate-400 w-4 h-4" : "text-slate-400 w-4 h-4"} />}
        </h3>
        <span className={`text-sm font-bold whitespace-nowrap ${highlighted ? "text-cyan-200" : "text-primary"}`}>{unlocked ? "Owned" : price}</span>
      </div>
      <p className={`text-sm leading-relaxed mb-5 ${highlighted ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
      <ul className="space-y-2.5 mb-7">
        {features.map((feature) => (
          <li key={feature} className={`flex gap-2 text-sm font-medium ${highlighted ? "text-slate-200" : "text-slate-700"}`}><Check className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> {feature}</li>
        ))}
      </ul>
      <button
        disabled={disabled}
        onClick={onClick}
        className={`w-full min-h-[46px] py-3 rounded-xl font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${unlocked ? "bg-emerald-100 text-emerald-700" : highlighted ? "bg-white text-slate-900 hover:bg-blue-50" : "bg-primary hover:bg-blue-600 text-white"}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
