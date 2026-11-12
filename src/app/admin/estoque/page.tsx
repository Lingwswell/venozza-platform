"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import StockLevels from "@/components/admin/estoque/StockLevels";
import IngredientsTab from "@/components/admin/estoque/IngredientsTab";
import RecipesTab from "@/components/admin/estoque/RecipesTab";
import SupplyTab from "@/components/admin/estoque/SupplyTab";
import { can, normalizeRole, type Role } from "@/lib/auth/roles";

// Estoque de insumos: saldo por loja e da cozinha central, insumos, ficha tecnica
// e pedidos de abastecimento. O servidor confere todas as permissoes.

type Tab = "estoque" | "abastecimento" | "insumos" | "ficha";

function readRole(): Role | null {
  try {
    const raw = localStorage.getItem("venozza_user") || sessionStorage.getItem("venozza_user");
    return normalizeRole(raw ? JSON.parse(raw)?.role : null);
  } catch {
    return null;
  }
}

export default function EstoquePage() {
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<Tab>("estoque");

  useEffect(() => {
    setRole(readRole());
  }, []);

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "estoque", label: "Estoque", show: true },
    { key: "abastecimento", label: "Abastecimento", show: true },
    { key: "insumos", label: "Insumos", show: true },
    { key: "ficha", label: "Ficha técnica", show: can.manageCatalog(role) },
  ];

  return (
    <AdminShell title="Estoque" subtitle="Insumos da loja e da cozinha central, com baixa automática pela ficha técnica.">
      <div className="flex flex-col gap-5">
        <nav className="flex flex-wrap gap-2" aria-label="Seções do estoque">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-bold transition",
                  tab === t.key ? "border-orange-500 bg-orange-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
        </nav>

        {tab === "estoque" ? <StockLevels /> : null}
        {tab === "abastecimento" ? <SupplyTab role={role} /> : null}
        {tab === "insumos" ? <IngredientsTab /> : null}
        {tab === "ficha" ? <RecipesTab /> : null}
      </div>
    </AdminShell>
  );
}
