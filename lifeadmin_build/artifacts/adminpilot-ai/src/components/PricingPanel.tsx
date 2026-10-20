export function AppHelpPanel() {
  return (
    <section id="support" aria-labelledby="support-heading" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20">
      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <h2 id="support-heading" className="text-3xl font-extrabold text-slate-900">Examples & support</h2>
        <p className="mt-3 text-slate-600">See sample plans, learn about the app and contact Tenaciouspl on our website.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="https://tenaciouspl.co.uk/#example" target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 font-bold text-white underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">See website examples <span className="sr-only">(opens in a new tab)</span></a>
          <a href="https://tenaciouspl.co.uk/#contact" target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-900 underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Website support <span className="sr-only">(opens in a new tab)</span></a>
          <a href="mailto:tenaciouspl@icloud.com" className="min-h-[44px] inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-900 underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Email support</a>
        </div>
      </div>
    </section>
  );
}
