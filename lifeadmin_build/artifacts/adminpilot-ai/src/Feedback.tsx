import type { ReactNode } from "react";

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" className={"inline-block h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none " + className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export function EmptyState({ title, description, action, onAction }: {
  title: string; description: ReactNode; action?: string; onAction?: () => void;
}) {
  return <div className="mt-4 min-w-0 rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 px-3 py-7 text-center sm:px-5">
    <svg aria-hidden="true" className="mx-auto h-14 w-14 text-violet-700 sm:h-20 sm:w-20" viewBox="0 0 96 96" fill="none">
      <rect x="20" y="13" width="56" height="70" rx="11" fill="white" stroke="currentColor" strokeWidth="3" />
      <path d="M32 32h32M32 43h21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      <circle cx="62" cy="64" r="16" fill="#CCFBF1" stroke="#0F766E" strokeWidth="3" />
      <path d="m55 64 5 5 9-11" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
    <p className="mx-auto mt-1 max-w-md text-slate-600">{description}</p>
    {action && onAction && <button type="button" className="mt-4 min-h-[44px] max-w-full rounded-xl bg-violet-700 px-3 py-2 sm:px-5 font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700" onClick={onAction}>{action}</button>}
  </div>;
}
