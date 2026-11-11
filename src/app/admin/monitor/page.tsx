"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type StoreSummary = {
  id: string;
  name: string;
  status: { open: boolean; message: string };
  active: number;
  late: number;
  byStatus: Record<string, number>;
  todayOrders: number;
  todayRevenue_cents: number;
  todayCancelled: number;
};

type MonitorOrder = {
  id: string;
  orderCode: string;
  storeId: string;
  storeName: string;
  status: string;
  customerFirstName: string;
  total_cents: number;
  elapsedMin: number;
  late: boolean;
  warning: boolean;
  items: string[];
};

type MonitorData = {
  generatedAt: string;
  totals: { active: number; late: number; warning: number; todayOrders: number; todayRevenue_cents: number };
  stores: StoreSummary[];
  orders: MonitorOrder[];
};

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  saiu_entrega: "Saiu p/ entrega",
};

const STATUS_COLOR: Record<string, string> = {
  novo: "bg-sky-100 text-sky-700",
  preparo: "bg-amber-100 text-amber-700",
  pronto: "bg-emerald-100 text-emerald-700",
  saiu_entrega: "bg-violet-100 text-violet-700",
};

const REFRESH_MS = 15000;

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState("");
  const [storeId, setStoreId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [onlyLate, setOnlyLate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/monitor");
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar o monitor.");
      setData(json);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o monitor.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const orders = useMemo(() => {
    const list = (data?.orders || []).filter(
      (o) =>
        (!storeId || o.storeId === storeId) &&
        (!statusFilter || o.status === statusFilter) &&
        (!onlyLate || o.late)
    );
    // Mais atrasados primeiro.
    return [...list].sort((a, b) => b.elapsedMin - a.elapsedMin);
  }, [data, storeId, statusFilter, onlyLate]);

  return (
    <AdminShell title="Monitor da operação" subtitle="Pedidos em andamento de todas as suas lojas, ao vivo.">
      <div className="flex flex-col gap-6">
        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Em andamento</p>
                <strong className="mt-1 block text-3xl text-slate-900">{data.totals.active}</strong>
              </div>
              <button
                type="button"
                onClick={() => setOnlyLate((v) => !v)}
                className={[
                  "rounded-3xl border p-5 text-left shadow-sm transition",
                  data.totals.late > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white",
                  onlyLate ? "ring-2 ring-rose-400" : "",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-rose-700">Atrasados</p>
                <strong className="mt-1 block text-3xl text-rose-700">{data.totals.late}</strong>
                <span className="text-xs text-rose-600">{onlyLate ? "mostrando só atrasados" : "clique para filtrar"}</span>
              </button>
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm font-semibold text-amber-700">No limite</p>
                <strong className="mt-1 block text-3xl text-amber-700">{data.totals.warning}</strong>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Pedidos hoje</p>
                <strong className="mt-1 block text-3xl text-slate-900">{data.totals.todayOrders}</strong>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Faturamento hoje</p>
                <strong className="mt-1 block text-2xl text-slate-900">{money(data.totals.todayRevenue_cents)}</strong>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.stores.map((store) => {
                const selected = storeId === store.id;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setStoreId(selected ? "" : store.id)}
                    className={[
                      "rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:border-orange-300",
                      selected ? "border-orange-500 ring-2 ring-orange-200" : "border-slate-200",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-slate-900">{store.name}</strong>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          store.status.open ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {store.status.open ? "Aberta" : "Fechada"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
                      {Object.entries(store.byStatus).map(([st, n]) => (
                        <span key={st} className={`rounded-full px-2 py-0.5 ${STATUS_COLOR[st] || "bg-slate-100"}`}>
                          {STATUS_LABEL[st] || st}: {n}
                        </span>
                      ))}
                      {store.late > 0 ? (
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-white">{store.late} atrasado(s)</span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Hoje: {store.todayOrders} pedidos · {money(store.todayRevenue_cents)}
                      {store.todayCancelled > 0 ? ` · ${store.todayCancelled} cancelado(s)` : ""}
                    </p>
                  </button>
                );
              })}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
                {["", "novo", "preparo", "pronto", "saiu_entrega"].map((st) => (
                  <button
                    key={st || "all"}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-bold",
                      statusFilter === st ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {st ? STATUS_LABEL[st] : "Todos"}
                  </button>
                ))}
                <span className="ml-auto text-xs text-slate-400">
                  Atualiza a cada {REFRESH_MS / 1000}s · {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
                </span>
              </div>

              {orders.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">Nenhum pedido em andamento com esses filtros.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <li
                      key={o.id}
                      className={[
                        "grid gap-2 p-4 md:grid-cols-[110px_1fr_140px_120px_100px] md:items-center",
                        o.late ? "bg-rose-50" : o.warning ? "bg-amber-50/60" : "",
                      ].join(" ")}
                    >
                      <strong className="font-mono text-sm text-slate-900">{o.orderCode}</strong>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{o.items.join(", ")}</p>
                        <p className="text-xs text-slate-500">
                          {o.storeName} · {o.customerFirstName}
                        </p>
                      </div>
                      <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[o.status] || "bg-slate-100"}`}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                      <span
                        className={[
                          "text-sm font-black",
                          o.late ? "text-rose-600" : o.warning ? "text-amber-600" : "text-slate-600",
                        ].join(" ")}
                      >
                        {o.elapsedMin} min {o.late ? "· atrasado" : ""}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{money(o.total_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : !error ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
