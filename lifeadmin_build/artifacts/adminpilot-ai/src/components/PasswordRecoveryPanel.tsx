import { useState } from "react";

type Props = { token?: string; onComplete?: () => Promise<void> };

export function PasswordRecoveryPanel({ token, onComplete }: Props) {
  const [open, setOpen] = useState(Boolean(token));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (token && password !== confirmation) {
      setError("Enter matching new passwords.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(token ? "/api/auth/reset-password" : "/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, password, password_confirm: confirmation } : { email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Recovery is unavailable. Please retry or contact support.");
      setPassword("");
      setConfirmation("");
      setMessage(data.message || "Check your email for the next step.");
      if (token) setComplete(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Recovery is unavailable. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary";
  const button = "min-h-[44px] rounded-xl px-4 py-3 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50";
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      {!token && <button type="button" className={`${button} text-primary underline`} aria-expanded={open} aria-controls="password-recovery" onClick={() => setOpen(!open)}>Forgot password?</button>}
      {open && <div id="password-recovery">
        <h3 className="mb-2 text-lg font-bold text-slate-900">{token ? "Set a new password" : "Recover your account"}</h3>
        <p className="mb-4 text-sm text-slate-600">Your saved plans and paid access stay with your existing account. Do not pay again.</p>
        {!complete && <form className="space-y-3" onSubmit={submit}>
          {token ? <>
            <label className="block font-bold text-sm" htmlFor="recovery-password">New password</label>
            <input id="recovery-password" className={field} type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} />
            <label className="block font-bold text-sm" htmlFor="recovery-confirmation">Confirm new password</label>
            <input id="recovery-confirmation" className={field} type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          </> : <>
            <label className="block font-bold text-sm" htmlFor="recovery-email">Account email</label>
            <input id="recovery-email" className={field} type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
          </>}
          <button type="submit" disabled={busy} aria-busy={busy} className={`${button} bg-primary text-white`}>{busy ? "Please wait..." : token ? "Change password" : "Email a reset link"}</button>
        </form>}
        {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-emerald-900">{message}</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950">{error}</p>}
        {complete && <button type="button" className={`${button} mt-3 bg-primary text-white`} onClick={() => void onComplete?.()}>Return to sign in</button>}
        <a className={`${button} mt-2 inline-flex items-center text-primary underline`} href="mailto:tenaciouspl@icloud.com">Contact support</a>
        <p className="mt-2 text-xs text-slate-500">Never send your password or reset link to support.</p>
      </div>}
    </div>
  );
}
