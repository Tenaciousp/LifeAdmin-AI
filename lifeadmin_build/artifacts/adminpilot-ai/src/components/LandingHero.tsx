import { ArrowRight, ShieldCheck, Lock, CheckCircle2, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function LandingHero() {
  const scrollToApp = (event: React.MouseEvent) => {
    event.preventDefault();
    trackEvent("start_flow", { location: "hero_cta" });
    document.getElementById("app")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative overflow-hidden bg-[#0f172a] text-white pt-24 pb-20 md:pt-36 md:pb-28 px-5 sm:px-6">
      <div className="absolute -top-20 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-28 right-1/4 w-[30rem] h-[30rem] bg-cyan-500/20 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-7">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm font-semibold text-blue-100">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            Household admin without the admin headache
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.06] max-w-4xl">
            Sort bills, renewals and subscriptions without the admin headache.
          </h1>

          <p className="text-lg sm:text-xl text-blue-100/85 leading-relaxed max-w-2xl">
            Choose a bill, add what you know, and get clear next steps, a provider message and a checklist you stay in control of.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={scrollToApp}
              className="min-h-[52px] bg-primary hover:bg-blue-600 text-white px-7 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Start with a bill <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#examples"
              className="min-h-[52px] bg-white/10 hover:bg-white/15 text-white px-7 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center transition-all border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              See examples
            </a>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm font-semibold text-blue-100/90">
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> No bank connection</div>
            <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-emerald-400" /> No mailbox access</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> You review every action</div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl">
            <div className="bg-white rounded-2xl p-5 sm:p-6 text-slate-900 shadow-xl">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">LifeAdmin plan</p>
                  <h2 className="text-xl font-extrabold mt-1">Sky bill too high</h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">Ready to review</span>
              </div>

              <div className="space-y-3 text-sm">
                <PreviewRow number="1" title="Next steps" text="Check the package, contract date and discounts ending." />
                <PreviewRow number="2" title="Provider message" text="Ask for the cheapest suitable package and written terms." />
                <PreviewRow number="3" title="Things to check" text="Minimum term, equipment return and bundled discounts." />
                <PreviewRow number="4" title="Approval checklist" text="Review the price, term and exit fees before agreeing." />
              </div>

              <div className="mt-5 rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-300 font-semibold">Core one-time price</p>
                  <p className="text-sm text-slate-200">No subscription</p>
                </div>
                <strong className="text-2xl">£0.99</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex gap-3">
      <span className="w-7 h-7 shrink-0 rounded-lg bg-blue-100 text-primary font-extrabold flex items-center justify-center text-xs">{number}</span>
      <div>
        <strong className="block text-slate-800">{title}</strong>
        <span className="text-slate-500 leading-relaxed">{text}</span>
      </div>
    </div>
  );
}
