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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <a href="/" className="text-primary hover:underline mt-4 inline-block">Return home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <CheckoutReturnHandler />
      <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600 font-semibold" aria-live="polite">Loading…</div>}>
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
