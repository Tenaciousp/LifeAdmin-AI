import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { LandingPage } from "./pages/LandingPage";

const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").then((module) => ({ default: module.AdminDashboard })),
);
import { Toaster } from "@/components/ui/sonner";
import { CheckoutReturnHandler } from "@/components/CheckoutReturnHandler";

function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center" role="alert" aria-labelledby="not-found-heading">
        <h1 id="not-found-heading" className="text-4xl font-bold mb-4">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <a href="/" className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">Return home</a>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      <CheckoutReturnHandler />
      <Suspense fallback={<div role="status" aria-busy="true" className="min-h-screen grid place-items-center bg-slate-50 text-slate-600 font-semibold">Loading…</div>}>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/admin" component={AdminDashboard} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <Toaster position="bottom-right" />
    </>
  );
}
