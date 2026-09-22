import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

export function CheckoutReturnHandler() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("checkout");
    const sessionId = params.get("session_id");
    if (!state) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };

    if (state === "cancelled") {
      toast.info("Checkout cancelled. No purchase was made.");
      cleanUrl();
      return;
    }

    if (state !== "success" || !sessionId) {
      cleanUrl();
      return;
    }

    let cancelled = false;
    const verify = async () => {
      try {
        const response = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "We could not verify this purchase yet.");
        if (cancelled) return;
        if (data.paid) {
          toast.success(data.product_id === "all_access" ? "All Access unlocked" : "LifeAdmin AI Core unlocked");
          trackEvent("purchase_verified", { product: data.product_id || "unknown" });
          await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        } else {
          toast.info("Payment is still processing. Your access will update when payment completes.");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "We could not verify this purchase yet.");
        }
      } finally {
        if (!cancelled) cleanUrl();
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return null;
}
