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
    let verifying = false;
    const retryAction = { label: "Retry verification", onClick: () => void verify() };
    const verify = async () => {
      if (cancelled || verifying) return;
      verifying = true;
      try {
        const response = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "We could not verify this purchase yet.");
        if (cancelled) return;
        if (data.paid) {
          toast.success("HomeAdmin Complete unlocked");
          trackEvent("purchase_verified", { product: data.product_id || "unknown" });
          cleanUrl();
          await queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        } else {
          toast.info("Payment is still processing. Retry verification after payment completes.", {
            action: retryAction,
            duration: 10000,
          });
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "We could not verify this purchase yet.", {
            action: retryAction,
            description: "Retry verification or reload this page. No new checkout will be started.",
            duration: 10000,
          });
        }
      } finally {
        verifying = false;
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return null;
}

