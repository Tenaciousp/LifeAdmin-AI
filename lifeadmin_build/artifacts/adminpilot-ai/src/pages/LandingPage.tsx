import { LandingHero } from "@/components/LandingHero";
import { CustomerJourney } from "@/components/CustomerJourney";
import { PricingPanel } from "@/components/PricingPanel";
import { AccountPanel } from "@/components/AccountPanel";
import { AnalyticsConsent, resetAnalyticsConsent } from "@/components/AnalyticsConsent";
import { CheckCircle2, ChevronDown, ShieldCheck, Sparkles, Search, FileCheck2, MailCheck, MousePointerClick } from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";

const examples = [
  "Reduce my Sky bill",
  "Cancel Netflix",
  "Check my mobile bill",
  "Review car insurance",
  "Energy tariff ending",
  "Council tax query",
  "Cancel gym membership",
  "Identify a card charge",
];

const faqs = [
  ["Does LifeAdmin contact providers for me?", "No. It prepares plans, provider messages and checklists. You review and send anything yourself."],
  ["Does it connect to my bank or email?", "No bank connection or mailbox access is required for the core workflow. You enter only the details you choose to use."],
  ["What happens if I do not know all the details?", "Leave them blank. LifeAdmin highlights useful missing information before it generates a plan, without blocking you."],
  ["Is it a subscription?", "No. Core is a one-time 99p/99c purchase. All Access is an additional one-time £1.99/$1.99 purchase."],
  ["Can I try it before creating an account?", "Yes. You can use the planning flow first and create an account later if you want to save plans and purchases across sessions."],
  ["Is this legal or financial advice?", "No. LifeAdmin provides general admin guidance and draft wording. For regulated or high-stakes issues, check official information or seek qualified advice."],
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-primary/20 selection:text-primary">
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0f172a]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2 text-white font-extrabold text-lg sm:text-xl tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-sm shadow-lg shadow-blue-500/20">LA</div>
            LifeAdmin AI
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-blue-100/80">
            <a href="#examples" className="hover:text-white transition-colors">Examples</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#addons" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <a href="#app" className="min-h-[44px] inline-flex items-center bg-white text-slate-900 hover:bg-blue-50 px-4 py-2 rounded-full text-sm font-bold transition-colors">
            Start with a bill
          </a>
        </div>
      </nav>

      <main id="top">
        <LandingHero />

        <section id="examples" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">Start with the problem you have</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Built around the household admin people actually put off.</h2>
            <p className="text-lg text-slate-600">Search for the provider, bill or payment. LifeAdmin suggests the bill type and the most useful goal, then you stay in control.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {examples.map((example) => (
              <a key={example} href="#app" className="group min-h-[72px] bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0"><Search className="w-4 h-4" /></span>
                <span className="font-bold text-slate-800 group-hover:text-primary">{example}</span>
              </a>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">How it works</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">From messy bill to a clear next move.</h2>
              <p className="text-lg text-slate-600">No generic chat prompt needed. The guided flow asks only for information that improves the result.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-5">
              <HowCard icon={<MousePointerClick />} number="1" title="Choose the bill" text="Search a provider, payment or household category." />
              <HowCard icon={<Sparkles />} number="2" title="Choose your goal" text="Check, reduce, renew, cancel, challenge or contact." />
              <HowCard icon={<FileCheck2 />} number="3" title="Add what you know" text="Useful details are optional. Missing information is highlighted." />
              <HowCard icon={<MailCheck />} number="4" title="Use the plan" text="Review next steps, provider message and approval checklist." />
            </div>
          </div>
        </section>

        <div className="bg-slate-100 border-b border-slate-200 py-4 md:py-8">
          <CustomerJourney />
        </div>

        <section id="benefits" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">You stay in control</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Useful enough to act on. Cautious enough to review first.</h2>
            <p className="text-lg text-slate-600">LifeAdmin is designed for everyday household administration without asking for broad access to your financial or communication accounts.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              ["Privacy-light by design", "No bank connection or mailbox access is required for the core workflow."],
              ["Approval before action", "The app prepares drafts and checklists. It does not send, cancel or purchase for you."],
              ["Household-bill specific", "Twelve categories and seven goals guide the questions and output."],
              ["Simple one-time pricing", "Core is 99p/99c once. All Access adds £1.99/$1.99 once. No subscription."],
            ].map(([title, text]) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <ShieldCheck className="w-8 h-8 text-primary mb-5" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-white border-y border-slate-200">
          <AccountPanel />
        </div>

        <div className="bg-slate-50">
          <PricingPanel />
        </div>

        <section id="privacy" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20 grid md:grid-cols-2 gap-6">
          <div id="terms" className="bg-white rounded-2xl p-7 md:p-8 border border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">Privacy</p>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4">Only add what the task needs.</h2>
            <p className="text-slate-600 mb-6 leading-relaxed">LifeAdmin does not require bank, email or calendar access. Signed-in tasks and plans are stored against your account. Passwords are salted and hashed and sessions use protected cookies.</p>
            <ul className="space-y-3">
              <TrustItem text="Try the planning flow before creating an account." />
              <TrustItem text="Do not enter passwords, full card numbers or security codes." />
              <TrustItem text="Delete your account and saved data from the Account panel." />
            </ul>
          </div>
          <div className="bg-white rounded-2xl p-7 md:p-8 border border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">Guidance only</p>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4">Check provider terms and official information before acting.</h2>
            <p className="text-slate-600 mb-6 leading-relaxed">LifeAdmin creates drafts, checklists and general information. It does not provide legal, financial, medical, tax or insurance advice.</p>
            <ul className="space-y-3">
              <TrustItem text="You decide whether to send, cancel, switch, dispute or purchase." />
              <TrustItem text="High-stakes issues should be checked with the relevant provider or qualified support." />
              <TrustItem text="Nothing is sent to another AI service automatically." />
            </ul>
          </div>
        </section>

        <section id="faq" className="bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-20">
            <div className="text-center mb-10">
              <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">Straight answers before you start.</h2>
            </div>
            <Accordion.Root type="single" collapsible className="space-y-3">
              {faqs.map(([question, answer], index) => (
                <Accordion.Item key={question} value={`faq-${index}`} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                  <Accordion.Header>
                    <Accordion.Trigger className="group w-full text-left px-5 py-4 min-h-[56px] flex items-center justify-between gap-4 font-bold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
                      {question}
                      <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="px-5 pb-5 text-slate-600 leading-relaxed data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                    {answer}
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
        </section>
      </main>

      <AnalyticsConsent />

      <footer className="bg-slate-900 text-slate-400 py-10 text-center text-sm border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-6">
          <p className="mb-4">LifeAdmin AI prepares plans and drafts only. You approve all messages, purchases, cancellations and official decisions.</p>
          <p className="flex flex-wrap justify-center gap-4 font-semibold text-slate-300">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-white transition-colors">Terms</a>
            <a href="#account" className="hover:text-white transition-colors">Account & deletion</a>
            <button type="button" onClick={resetAnalyticsConsent} className="hover:text-white transition-colors">Analytics choices</button>
          </p>
        </div>
      </footer>
    </div>
  );
}

function HowCard({ icon, number, title, text }: { icon: React.ReactNode; number: string; title: string; text: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="w-10 h-10 rounded-xl bg-blue-100 text-primary flex items-center justify-center">{icon}</span>
        <span className="text-xs font-black text-slate-400">0{number}</span>
      </div>
      <h3 className="font-extrabold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function TrustItem({ text }: { text: string }) {
  return <li className="flex gap-3 text-sm text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> {text}</li>;
}
