"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActiveOrderId } from "@/lib/active-order";

export default function ActiveOrderCard() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      setActiveOrderId(getActiveOrderId());
    }

    refresh();

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  if (!activeOrderId) return null;

  return (
    <Link
      href={`/m/s/${activeOrderId}`}
      className="mb-4 flex items-center justify-between rounded-3xl border border-[#ffdada] bg-white px-4 py-4 shadow-sm"
    >
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff1010]">
          Pedido em andamento
        </p>
        <p className="mt-1 text-sm font-bold text-[#202020]">
          Acompanhar {activeOrderId}
        </p>
      </div>

      <span className="rounded-full bg-[#ff1010] px-4 py-2 text-xs font-black text-white">
        Ver agora
      </span>
    </Link>
  );
}
