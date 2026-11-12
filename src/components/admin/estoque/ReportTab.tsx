"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { Notice, cardClass, formatQuantity, ghostButton, inputClass, money } from "@/components/admin/estoque/shared";

type Location = { id: string; name: string; central: boolean };
type StoreRow = {
  id: string;
  name: string;
  orders: number;
  revenueCents: number;
  cmvCents: number;
  cmvPct: number | null;
  lossCents: number;
  lossPct: number | null;
  missingCost: number;
};
type IngredientRow = {
  ingredientId: string;
  name: string;
  unit: string;
  hasCost: boolean;
  used: number;
  lost: number;
  countDiff: number;
  received: number;
  usedCents: number;
  lostCents: number;
  countDiffCents: number;
};
type Report = {
  days: number;
  locations: Location[];
  location: string;
  stores: StoreRow[];
  detail: { rows: IngredientRow[]; lossCents: number; totals: { usedCents: number; missingCost: number } };
};

const PERIODS = [
  { days: 1, label: "Hoje" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
];

function pct(v: number | null) {
  return v === null ? "—" : `${v.toLocaleString("pt-BR")}%`;
}

export default function ReportTab() {
  const [report, setReport] = useState<Report | null>(null);
  const [days, setDays] = useState(7);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (d: number, loc: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ days: String(d) });
      if (loc) qs.set("location", loc);
      const res = await fetchWithAuth(`/api/admin/stock/report?${qs}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao montar o relatório.");
      setReport(data);
      setLocation(data.location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar o relatório.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(7, "");
  }, [load]);

  const missing = report?.stores.reduce((s, r) => s + r.missingCost, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => {
                setDays(p.days);
                load(p.days, location);
              }}
              className={`${ghostButton} ${days === p.days ? "border-orange-400 bg-orange-50" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="max-w-xl text-sm text-slate-600">
          CMV é o custo dos insumos que as vendas gastaram, pela ficha técnica, comparado com o que foi vendido (sem frete).
          Perda soma o que foi lançado como perda e o que faltou nas contagens.
        </p>
      </section>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {missing > 0 ? (
        <Notice kind="error">
          Há insumos com movimento e sem custo cadastrado: eles ficam fora dos valores. Cadastre o custo na aba Insumos.
        </Notice>
      ) : null}

      {loading && !report ? <p className="text-sm text-slate-500">Carregando...</p> : null}

      {report && report.stores.length > 0 ? (
        <section className={cardClass}>
          <h3 className="text-base font-black text-slate-900">Lojas lado a lado</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th className="py-2 pr-3">Loja</th>
                  <th className="py-2 pr-3">Pedidos</th>
                  <th className="py-2 pr-3">Vendido</th>
                  <th className="py-2 pr-3">CMV</th>
                  <th className="py-2 pr-3">Perda</th>
                </tr>
              </thead>
              <tbody>
                {report.stores.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{s.orders}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{money(s.revenueCents)}</td>
                    <td className="py-2.5 pr-3">
                      <strong className="text-slate-900">{money(s.cmvCents)}</strong>{" "}
                      <span className="text-xs text-slate-500">{pct(s.cmvPct)}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <strong className={s.lossCents > 0 ? "text-rose-700" : "text-slate-900"}>{money(s.lossCents)}</strong>{" "}
                      <span className="text-xs text-slate-500">{pct(s.lossPct)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {report ? (
        <section className={cardClass}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">Por insumo</h3>
            <label className="w-64">
              <span className="mb-1 block text-xs font-bold text-slate-500">Local</span>
              <select value={location} onChange={(e) => load(days, e.target.value)} className={inputClass}>
                {report.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {report.detail.rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhum movimento neste período.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
                    <th className="py-2 pr-3">Insumo</th>
                    <th className="py-2 pr-3">Gasto nas vendas</th>
                    <th className="py-2 pr-3">Perda lançada</th>
                    <th className="py-2 pr-3">Diferença na contagem</th>
                    <th className="py-2 pr-3">Entrou</th>
                  </tr>
                </thead>
                <tbody>
                  {report.detail.rows.map((r) => (
                    <tr key={r.ingredientId} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 font-bold text-slate-900">
                        {r.name}
                        {!r.hasCost ? <span className="ml-1 text-xs font-normal text-amber-600">sem custo</span> : null}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {formatQuantity(r.used, r.unit)}
                        {r.hasCost ? <span className="block text-xs text-slate-500">{money(r.usedCents)}</span> : null}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {formatQuantity(r.lost, r.unit)}
                        {r.hasCost && r.lost ? <span className="block text-xs text-rose-600">{money(r.lostCents)}</span> : null}
                      </td>
                      <td className={["py-2.5 pr-3", r.countDiff < 0 ? "text-rose-700" : "text-slate-700"].join(" ")}>
                        {r.countDiff > 0 ? "+" : ""}
                        {formatQuantity(r.countDiff, r.unit)}
                        {r.hasCost && r.countDiff ? <span className="block text-xs">{money(r.countDiffCents)}</span> : null}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{formatQuantity(r.received, r.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
