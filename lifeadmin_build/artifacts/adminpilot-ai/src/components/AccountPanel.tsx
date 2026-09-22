import { useState } from "react";
import { useAuthMe } from "@/hooks/use-api";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Trash2 } from "lucide-react";

export function AccountPanel() {
  const { data: auth, isLoading } = useAuthMe();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const refreshAccountQueries = () => {
    queryClient.removeQueries({ queryKey: ["/api/tasks"] });
    queryClient.removeQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const handleAction = async (path: string) => {
    if (!email || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setIsBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      toast.success(path === "/api/auth/register" ? "Account created" : "Signed in");
      setPassword("");
      if (path === "/api/auth/register") trackEvent("account_created");
      refreshAccountQueries();
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogout = async () => {
    setIsBusy(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", body: "{}" });
      if (!res.ok) throw new Error("Could not sign out");
      toast.success("Signed out");
      refreshAccountQueries();
    } catch (err: any) {
      toast.error(err.message || "Could not sign out");
    } finally {
      setIsBusy(false);
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
    setIsBusy(true);
    try {
      const res = await fetch("/api/auth/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete account");
      toast.success("Account deleted");
      setPassword("");
      setDeleteConfirm("");
      setShowDelete(false);
      refreshAccountQueries();
    } catch (err: any) {
      toast.error(err.message || "Could not delete account");
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) return null;

  return (
    <section id="account" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-20 grid md:grid-cols-2 gap-10 md:gap-12 items-start">
      <div>
        <p className="text-sm font-bold text-primary tracking-wider uppercase mb-2">Save your work</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Try first. Create an account only when you want to save.</h2>
        <p className="text-lg text-slate-600 mb-6">The planning flow works without an account. Sign in later to keep tasks, plans and purchases available across sessions.</p>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3 text-blue-950">
          <ShieldCheck className="w-6 h-6 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed"><strong className="block mb-1">Your saved work stays separated by account.</strong>Guest work is isolated from other visitors, and signed-in work is stored against your account.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
        {auth?.authenticated ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <strong className="text-emerald-900 block mb-1">Signed in</strong>
              <span className="text-emerald-700 text-sm">Tasks and plans are saved to your account.</span>
              <p className="text-xs mt-2 text-emerald-800 break-all">{auth.user?.email}</p>
            </div>

            <button onClick={handleLogout} disabled={isBusy} className="w-full min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50">
              Sign out
            </button>

            <div className="pt-6 mt-6 border-t border-slate-100">
              {!showDelete ? (
                <button onClick={() => setShowDelete(true)} className="w-full min-h-[44px] py-2.5 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" /> Account settings & deletion
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div>
                    <strong className="text-red-900 block">Permanently delete this account?</strong>
                    <p className="text-sm text-red-800 mt-1">This deletes saved tasks, plans, sessions and purchase records. It cannot be undone.</p>
                  </div>
                  <label className="block text-sm font-bold text-slate-700">Password</label>
                  <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-white border border-red-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <label className="block text-sm font-bold text-slate-700">Type DELETE to confirm</label>
                  <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="DELETE" className="w-full bg-white border border-red-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); setPassword(""); }} className="min-h-[44px] py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl">Cancel</button>
                    <button onClick={handleDelete} disabled={isBusy || deleteConfirm !== "DELETE"} className="min-h-[44px] py-2.5 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl disabled:opacity-50">Delete my account</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleAction("/api/auth/register"); }}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="submit" disabled={isBusy} className="min-h-[46px] py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50">Create account</button>
              <button type="button" onClick={() => handleAction("/api/auth/login")} disabled={isBusy} className="min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50">Sign in</button>
            </div>
            <p className="text-center text-sm text-slate-500 mt-4">No account is required to create your first plan.</p>
          </form>
        )}
      </div>
    </section>
  );
}
