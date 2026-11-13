"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import type { BillingState } from "@/lib/billing/state";

export type BillingStatus = {
  state: BillingState;
  platformAdmin: boolean;
  needsOnboarding: boolean;
  features: Record<string, boolean>;
} | null;

// Situacao da assinatura para o menu e o aviso do topo (uma vez por pagina).
export function useBillingStatus(enabled: boolean): BillingStatus {
  const [status, setStatus] = useState<BillingStatus>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchWithAuth("/api/admin/billing/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) {
          setStatus({
            state: data.state,
            platformAdmin: Boolean(data.platformAdmin),
            needsOnboarding: Boolean(data.needsOnboarding),
            features: data.features || {},
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return status;
}
