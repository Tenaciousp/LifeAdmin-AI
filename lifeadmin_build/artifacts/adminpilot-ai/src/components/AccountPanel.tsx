import { useState } from "react";
import { useAuthMe } from "@/hooks/use-api";
import { saveBuyerEmail, clearBuyerEmail } from "@/lib/auth";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Trash2 } from "lucide-react";

const ACCOUNT_SCOPED_QUERY_KEYS = [
  ["/api/tasks"],
  ["/api/notes"],
  ["/api/products"],
  ["/api/admin/overview"],
] as const;

export function AccountPanel() {
  const { data: auth, isLoading, isError, refetch: retryAuth } = useAuthMe();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busyAction, setBusyAction] = useState<"register" | "login" | "logout" | "delete" | "retry-import" | null>(null);
  const isBusy = busyAction !== null;

  const clearCredentialState = () => {
    setEmail("");
    setPassword("");
    setDeleteConfirm("");
    setShowDelete(false);
  };

  const refreshAccountQueries = async (nextAuth: { authenticated: boolean; user?: { id: string; email?: string } }) => {
    // Prevent stale account-status and private-data requests from racing the new session.
    await queryClient.cancelQueries({ queryKey: ["/api/auth/me"] });
    for (const queryKey of ACCOUNT_SCOPED_QUERY_KEYS) {
      await queryClient.cancelQueries({ queryKey: [...queryKey] });
      queryClient.removeQueries({ queryKey: [...queryKey] });
    }
    // Publish the new identity only after old requests are cancelled.
    queryClient.setQueryData(["/api/auth/me"], nextAuth);
    void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const handleAction = async (path: string) => {
    if (!email || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setBusyAction(path === "/api/auth/register" ? "register" : "login");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      if (data.guest_import_pending) {
        toast.warning("Account created. Some guest work is still waiting to transfer.");
      } else {
        toast.success(path === "/api/auth/register" ? "Account created" : "Signed in");
      }
      clearCredentialState();
      if (path === "/api/auth/register") trackEvent("account_created");
      if (data.user?.email) saveBuyerEmail(data.user.email);
      await refreshAccountQueries(data);
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRetryGuestImport = async () => {
    setBusyAction("retry-import");
    try {
      const res = await fetch("/api/auth/retry-guest-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not retry your saved work transfer.");
      await retryAuth();
      for (const queryKey of ACCOUNT_SCOPED_QUERY_KEYS) {
        await queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
      if (data.guest_import_pending) {
        toast.warning("Some guest work is still waiting. You can safely try again.");
      } else {
        toast.success("Your remaining guest work has been transferred.");
      }
    } catch (err: any) {
      toast.error(err.message || "Transfer unavailable. Your remaining guest work is safe.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleLogout = async () => {
    setBusyAction("logout");
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", body: "{}" });
      if (!res.ok) throw new Error("Could not sign out");
      toast.success("Signed out");
      clearCredentialState();
      clearBuyerEmail();
      await refreshAccountQueries({ authenticated: false });
    } catch (err: any) {
      toast.error(err.message || "Could not sign out");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!password) {
      toast.error("Enter your password to confirm deletion.");
      return;
    }
    if (deleteConfirm !== "DELETE") {
      toast.error("Type DELETE exactly to confirm.");
      return;
    }
    setBusyAction("delete");
    try {
      const res = await fetch("/api/auth/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete account");
      toast.success("Account deleted");
      clearCredentialState();
      clearBuyerEmail();
      await refreshAccountQueries({ authenticated: false });
    } catch (err: any) {
      toast.error(err.message || "Could not delete account");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section id="account" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20 grid md:grid-cols-2 gap-10 md:gap-12 items-start">
      <div>
        <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">Save your work</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Try first. Create an account only when you want to save.</h2>
        <p className="text-lg text-slate-600 mb-6">The planning flow works without an account. Sign in later to keep tasks, plans and purchases available across sessions.</p>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3 text-blue-950">
          <ShieldCheck aria-hidden="true" className="w-6 h-6 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed"><strong className="block mb-1">Your saved work stays separated by account.</strong>Guest work is isolated from other visitors, and signed-in work is stored against your account.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
        {isLoading ? (
          <div role="status" aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
            <strong className="block">Checking account status...</strong>
            <p className="mt-1 text-sm">Your account controls will appear when the secure check finishes.</p>
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
            <strong className="block">We could not check your account</strong>
            <p className="mt-1 text-sm">Your account has not been changed. Check your connection, then try again.</p>
            <button
              type="button"
              onClick={() => void retryAuth()}
              className="mt-4 min-h-[44px] rounded-xl bg-amber-900 px-4 py-2.5 font-bold text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Try account check again
            </button>
          </div>
        ) : auth?.authenticated ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <strong className="text-emerald-900 block mb-1">Signed in</strong>
              <span className="text-emerald-700 text-sm">Tasks and plans are saved to your account.</span>
              <p className="text-xs mt-2 text-emerald-800 break-all">{auth.user?.email}</p>
            </div>

            {auth.guest_import_pending && (
              <div role="status" aria-live="polite" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <strong className="block">Some guest work is waiting to transfer</strong>
                <p className="mt-1 text-sm">
                  {auth.guest_import_retry_available
                    ? "Your remaining guest work is still saved in this browser. Retry here before signing out or changing browsers."
                    : "Your remaining guest work is linked to the browser where you created this account. Return to that browser, sign in and retry the transfer there."}
                </p>
                {auth.guest_import_retry_available && (
                  <button type="button" onClick={handleRetryGuestImport} disabled={isBusy} aria-busy={busyAction === "retry-import"} className="mt-3 min-h-[44px] rounded-lg bg-amber-900 px-4 py-2.5 font-bold text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50">
                    {busyAction === "retry-import" ? "Retrying transfer..." : "Retry transferring my work"}
                  </button>
                )}
              </div>
            )}

            <button onClick={handleLogout} disabled={isBusy} aria-busy={busyAction === "logout"} className="w-full min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50">
              {busyAction === "logout" ? "Signing out..." : "Sign out"}
            </button>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDelete((visible) => !visible)}
                aria-expanded={showDelete}
                aria-controls="account-deletion-panel"
                className="w-full min-h-[44px] py-2.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 aria-hidden="true" className="w-4 h-4" />
                {showDelete ? "Hide account settings" : "Account settings & deletion"}
              </button>
              {showDelete && (
                <div id="account-deletion-panel" className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4 mt-3">
                  <div>
                    <strong className="text-red-900 block">Permanently delete this account?</strong>
                    <p className="text-sm text-red-800 mt-1">This deletes saved tasks, plans, sessions and purchase records. It cannot be undone.</p>
                  </div>
                  <label htmlFor="account-delete-password" className="block text-sm font-bold text-slate-700">Password</label>
                  <input id="account-delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-white border border-red-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <label htmlFor="account-delete-confirm" className="block text-sm font-bold text-slate-700">Type DELETE to confirm</label>
                  <input id="account-delete-confirm" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="DELETE" className="w-full bg-white border border-red-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button type="button" onClick={() => { setShowDelete(false); setDeleteConfirm(""); setPassword(""); }} className="min-h-[44px] py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl">Cancel</button>
                    <button type="button" onClick={handleDelete} disabled={isBusy || deleteConfirm !== "DELETE"} aria-busy={busyAction === "delete"} className="min-h-[44px] py-2.5 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl disabled:opacity-50">
                      {busyAction === "delete" ? "Deleting account..." : "Delete my account"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleAction("/api/auth/register"); }}>
            <div>
              <label htmlFor="account-email" className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
              <input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="account-password" className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
              <input id="account-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="submit" disabled={isBusy} aria-busy={busyAction === "register"} className="min-h-[46px] py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                {busyAction === "register" ? "Creating account..." : "Create account"}
              </button>
              <button type="button" onClick={() => handleAction("/api/auth/login")} disabled={isBusy} aria-busy={busyAction === "login"} className="min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50">
                {busyAction === "login" ? "Signing in..." : "Sign in"}
              </button>
            </div>
            <p className="text-center text-sm text-slate-500 mt-4">No account is required to create your first plan.</p>
          </form>
        )}
      </div>
    </section>
  );
}
