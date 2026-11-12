"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

export type StockAlerts = { count: number; central: number; low: number; toReceive: number };

const EMPTY: StockAlerts = { count: 0, central: 0, low: 0, toReceive: 0 };

// Bipe curto quando o numero de avisos sobe (o navegador pode bloquear antes do primeiro clique).
function beep() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close().catch(() => undefined);
  } catch {
    // sem som, segue so o numero
  }
}

/** Avisos do estoque para o menu (atualiza a cada minuto). */
export function useStockAlerts(enabled: boolean): StockAlerts {
  const [alerts, setAlerts] = useState<StockAlerts>(EMPTY);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchWithAuth("/api/admin/stock/alerts");
        const data = await res.json();
        if (cancelled || !res.ok || !data?.ok) return;
        const next: StockAlerts = {
          count: Number(data.count) || 0,
          central: Number(data.central) || 0,
          low: Number(data.low) || 0,
          toReceive: Number(data.toReceive) || 0,
        };
        // So apita quando aumenta durante o uso (nao na abertura da pagina).
        if (last.current !== null && next.count > last.current) beep();
        last.current = next.count;
        setAlerts(next);
      } catch {
        // sem rede: tenta de novo no proximo minuto
      }
    };

    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return alerts;
}
