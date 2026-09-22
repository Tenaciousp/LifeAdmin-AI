import { Switch, Route } from "wouter";
import { LandingPage } from "./pages/LandingPage";
import { AdminDashboard } from "./pages/AdminDashboard";
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
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/admin" component={AdminDashboard} />
        <Route component={NotFound} />
      </Switch>
      <Toaster position="bottom-right" />
    </>
  );
}
