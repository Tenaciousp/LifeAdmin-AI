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
            List. Plan. Save.
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.06] max-w-4xl">
            Your household bills, with a plan for what to do next.
          </h1>

          <p className="text-lg sm:text-xl text-blue-100/85 leading-relaxed max-w-2xl">
            Save your bill details, review AI-assisted options and potential savings, then prepare an editable letter or email to your provider. Check every offer before making a decision.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={scrollToApp}
              className="min-h-[52px] bg-primary hover:bg-blue-600 text-white px-7 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Start with a bill <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="https://tenaciouspl.co.uk/#example"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[52px] bg-white/10 hover:bg-white/15 text-white px-7 py-3.5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center transition-all border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              See website examples
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
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">HomeAdmin plan</p>
                  <h2 className="text-xl font-extrabold mt-1">Reviewing a Sky bill</h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">Illustrative example</span>
              </div>

              <div className="space-y-3 text-sm">
                <PreviewRow number="1" title="Your bill" text="Review the current package, payment and renewal date." />
                <PreviewRow number="2" title="Compare options" text="Check equivalent offers, sources, contract lengths and fees." />
                <PreviewRow number="3" title="Potential difference" text="Estimate the change across your chosen period using checked figures." />
                <PreviewRow number="4" title="Editable provider email" text="Ask for a competitive renewal quote. Review before sending." />
              </div>

              <p className="mt-4 text-xs leading-relaxed text-slate-600">Example journey. No live price or saving is shown or independently verified.</p>
              <a href="https://tenaciouspl.co.uk/#contact" target="_blank" rel="noopener noreferrer" className="mt-4 block rounded-xl bg-slate-900 text-white p-4 font-semibold underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Examples and support at tenaciouspl.co.uk
              </a>
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
