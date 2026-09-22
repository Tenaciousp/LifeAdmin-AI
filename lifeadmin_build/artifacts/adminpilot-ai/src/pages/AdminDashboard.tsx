import { useMemo, useState } from "react";
import { useAdminOverview } from "@/hooks/use-api";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  FileText,
  Filter,
  History,
  LayoutList,
  Loader2,
  LockKeyhole,
  Target,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CATEGORY_LABELS: Record<string, string> = {
  tv_broadband_mobile: "TV, broadband & mobile",
  energy_water: "Energy & water",
  insurance: "Insurance",
  council_tax_licences: "Council, tax & licences",
  subscriptions_memberships: "Subscriptions & memberships",
  rent_mortgage_property: "Rent, mortgage & property",
  credit_loans_finance: "Credit, loans & finance",
  transport_vehicle: "Transport & vehicle",
  health_care_pets: "Health, care & pets",
  family_childcare_education: "Family, childcare & education",
  home_security_maintenance: "Home services & security",
  other_regular_payment: "Other regular payment",
};

const GOAL_LABELS: Record<string, string> = {
  identify_payment: "Identify a payment",
  check_bill: "Check my bill",
  prepare_renewal: "Prepare for renewal",
  reduce_price: "Reduce my price",
  cancel_switch: "Cancel or switch",
  challenge_charge: "Challenge a charge",
  contact_provider: "Contact provider",
};

export function AdminDashboard() {
  const { data, isLoading, error } = useAdminOverview();
  const [activityFilter, setActivityFilter] = useState("all");

  const metrics = data || {
    users: { total: 0 },
    tasks: { total: 0, open: 0, completed: 0 },
    plans: { total: 0, fallback: 0, ai: 0 },
    purchases: { entitlement_records: 0, core: 0, all_access: 0 },
    categories: {},
    goals: {},
    recent_activity: [],
  };

  const categoryData = useMemo(
    () => Object.entries(metrics.categories || {})
      .map(([name, count]) => ({ name: CATEGORY_LABELS[name] || humanise(name), count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    [metrics.categories],
  );

  const goalData = useMemo(
    () => Object.entries(metrics.goals || {})
      .map(([name, count]) => ({ name: GOAL_LABELS[name] || humanise(name), count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    [metrics.goals],
  );

  const activityTypes = useMemo(
    () => Array.from(new Set((metrics.recent_activity || []).map((item: any) => item.type || "task"))),
    [metrics.recent_activity],
  );
  const filteredActivity = (metrics.recent_activity || []).filter(
    (item: any) => activityFilter === "all" || (item.type || "task") === activityFilter,
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center" aria-live="polite">
        <div className="text-center text-slate-600">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" aria-hidden="true" />
          <p className="font-semibold">Loading dashboard…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center p-6">
        <div className="bg-white max-w-md w-full rounded-2xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full grid place-items-center mx-auto mb-6">
            <LockKeyhole className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Admin access required</h1>
          <p className="text-slate-600 mb-8">Sign in with an administrator account to view operational metrics.</p>
          <Link href="/#account" className="inline-flex min-h-[44px] w-full items-center justify-center py-3 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Back to LifeAdmin AI" className="min-h-[44px] min-w-[44px] grid place-items-center text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Link>
            <div>
              <div className="font-extrabold text-lg sm:text-xl tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary text-white grid place-items-center text-xs" aria-hidden="true">LA</span>
                LifeAdmin AI
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Operations dashboard</p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">Admin only</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Overview</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Product operations</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">Privacy-light usage and entitlement metrics. Customer bill text and provider messages are not shown here.</p>
        </div>

        <section aria-label="Key metrics" className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard title="Accounts" value={metrics.users?.total ?? 0} icon={<Users />} detail="Registered users" />
          <StatCard title="Tasks" value={metrics.tasks?.total ?? 0} icon={<CheckSquare />} detail={`${metrics.tasks?.open ?? 0} open · ${metrics.tasks?.completed ?? 0} completed`} />
          <StatCard title="Plans" value={metrics.plans?.total ?? 0} icon={<FileText />} detail={`${metrics.plans?.ai ?? 0} AI · ${metrics.plans?.fallback ?? 0} guided`} />
          <StatCard title="Purchases" value={metrics.purchases?.entitlement_records ?? 0} icon={<CreditCard />} detail={`${metrics.purchases?.core ?? 0} Core · ${metrics.purchases?.all_access ?? 0} All Access`} />
        </section>

        <section className="grid lg:grid-cols-2 gap-6 mb-8" aria-label="Usage charts">
          <MetricChart title="Top categories" icon={<LayoutList className="w-5 h-5" />} data={categoryData} empty="No category activity yet" />
          <MetricChart title="Top goals" icon={<Target className="w-5 h-5" />} data={goalData} empty="No goal activity yet" />
        </section>

        <section className="grid md:grid-cols-2 gap-6 mb-8" aria-label="Operational breakdown">
          <BreakdownCard
            title="Task status"
            items={[
              { label: "Open", value: metrics.tasks?.open ?? 0 },
              { label: "Completed", value: metrics.tasks?.completed ?? 0 },
            ]}
          />
          <BreakdownCard
            title="Access entitlements"
            items={[
              { label: "Core", value: metrics.purchases?.core ?? 0 },
              { label: "All Access", value: metrics.purchases?.all_access ?? 0 },
            ]}
          />
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-8" aria-labelledby="recent-activity-heading">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 id="recent-activity-heading" className="text-lg font-extrabold flex items-center gap-2"><History className="w-5 h-5 text-indigo-600" aria-hidden="true" /> Recent activity</h2>
              <p className="text-sm text-slate-500 mt-1">Operational events only. Sensitive task content is excluded.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Filter activity</span>
              <select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value)}
                className="min-h-[44px] bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All activity</option>
                {activityTypes.map((type) => <option key={String(type)} value={String(type)}>{humanise(String(type))}</option>)}
              </select>
            </label>
          </div>

          {filteredActivity.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[620px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200">
                  <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Time</th></tr>
                </thead>
                <tbody>
                  {filteredActivity.map((activity: any, index: number) => (
                    <tr key={`${activity.created_at || activity.time || "event"}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{humanise(activity.type || "task")}</td>
                      <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[activity.category] || humanise(activity.category || "Household admin")}</td>
                      <td className="px-4 py-3 text-slate-500 text-right whitespace-nowrap">{formatTime(activity.created_at || activity.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-slate-500 text-sm font-medium bg-slate-50 rounded-xl border border-dashed border-slate-300">
              No recent activity matches this filter.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, detail }: { title: string; value: string | number; icon: React.ReactNode; detail: string }) {
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <span className="w-10 h-10 rounded-xl bg-blue-50 text-primary grid place-items-center [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">{icon}</span>
      </div>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </article>
  );
}

function MetricChart({ title, icon, data, empty }: { title: string; icon: React.ReactNode; data: Array<{ name: string; count: number }>; empty: string }) {
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-6 flex items-center gap-2 text-slate-900">{icon}{title}</h2>
      <div className="h-[270px] w-full" aria-label={`${title} chart`}>
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} width={125} />
              <Tooltip contentStyle={{ borderRadius: "12px" }} />
              <Bar dataKey="count" fill="currentColor" className="text-blue-600" radius={[0, 5, 5, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-full grid place-items-center text-slate-500 text-sm font-medium">{empty}</div>}
      </div>
    </article>
  );
}

function BreakdownCard({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
      <h2 className="font-extrabold mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />{title}</h2>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-3">
            <span className="text-sm font-semibold text-slate-600">{item.label}</span>
            <span className="font-extrabold text-slate-900">{item.value}<span className="text-xs text-slate-400 font-medium ml-2">{total ? `${Math.round((item.value / total) * 100)}%` : "0%"}</span></span>
          </div>
        ))}
      </div>
    </article>
  );
}

function humanise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTime(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
