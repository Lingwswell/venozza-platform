"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type RangeKey = "last7days" | "thisMonth" | "last30days";

type DailyPoint = {
  date: string;
  label: string;
  revenue_cents: number;
  orders: number;
};

type StoreOption = {
  id: string;
  name: string;
};

type StoresResponse = {
  ok: boolean;
  role?: string;
  currentStoreId?: string | null;
  stores?: StoreOption[];
};

type ComparisonSummary = {
  orders: number;
  revenue_cents: number;
};

type RankingStore = {
  storeId: string;
  storeName: string;
  storeSlug: string | null;
  revenue_cents: number;
  orders: number;
  average_ticket_cents: number;
};

function moneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value || 0) / 100);
}

function getVariationPercent(current: number, previous: number) {
  if (previous <= 0) {
    if (current > 0) return 100;
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

function getVariationLabel(value: number) {
  const signal = value > 0 ? "+" : "";
  return `${signal}${value.toFixed(1)}%`;
}

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "last7days", label: "7 dias" },
  { key: "thisMonth", label: "Este mês" },
  { key: "last30days", label: "30 dias" },
];

export default function FinanceiroPage() {
  const [range, setRange] = useState<RangeKey>("last7days");
  const [role, setRole] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [ranking, setRanking] = useState<RankingStore[]>([]);
  const [currentSummary, setCurrentSummary] = useState<ComparisonSummary>({
    orders: 0,
    revenue_cents: 0,
  });
  const [previousSummary, setPreviousSummary] = useState<ComparisonSummary>({
    orders: 0,
    revenue_cents: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStores() {
      try {
        const res = await fetchWithAuth("/api/admin/stores");
        const data: StoresResponse = await res.json();

        if (!res.ok || !data?.ok || cancelled) return;

        setRole(String(data.role || ""));
        setStores(Array.isArray(data.stores) ? data.stores : []);
        setCurrentStoreId(data.currentStoreId || null);

        if (String(data.role || "").toLowerCase() !== "owner" && data.currentStoreId) {
          setSelectedStoreId(data.currentStoreId);
        }
      } catch {
        // silencioso
      }
    }

    loadStores();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFinanceiro() {
      try {
        setLoading(true);

        const params = new URLSearchParams();
        params.set("range", range);

        const effectiveStoreId =
          String(role).toLowerCase() === "owner"
            ? selectedStoreId
            : currentStoreId || selectedStoreId;

        if (effectiveStoreId) {
          params.set("storeId", effectiveStoreId);
        }

        const [dailyRes, rankingRes] = await Promise.all([
          fetchWithAuth(`/api/admin/financeiro/daily?${params.toString()}`),
          fetchWithAuth(`/api/admin/financeiro/ranking-stores?${params.toString()}`),
        ]);

        const dailyData = await dailyRes.json();
        const rankingData = await rankingRes.json();

        if (!dailyRes.ok || !dailyData?.ok || cancelled) return;
        if (!rankingRes.ok || !rankingData?.ok || cancelled) return;

        setSeries(Array.isArray(dailyData.series) ? dailyData.series : []);
        setRanking(Array.isArray(rankingData.ranking) ? rankingData.ranking : []);
        setCurrentSummary({
          orders: Number(dailyData.comparison?.current?.orders || 0),
          revenue_cents: Number(dailyData.comparison?.current?.revenue_cents || 0),
        });
        setPreviousSummary({
          orders: Number(dailyData.comparison?.previous?.orders || 0),
          revenue_cents: Number(dailyData.comparison?.previous?.revenue_cents || 0),
        });
      } catch {
        if (!cancelled) {
          setSeries([]);
          setRanking([]);
          setCurrentSummary({ orders: 0, revenue_cents: 0 });
          setPreviousSummary({ orders: 0, revenue_cents: 0 });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFinanceiro();

    return () => {
      cancelled = true;
    };
  }, [range, selectedStoreId, currentStoreId, role]);

  const ownerMode = String(role).toLowerCase() === "owner";

  const maxRevenue = useMemo(() => {
    return Math.max(...series.map((item) => item.revenue_cents), 0);
  }, [series]);

  const totalRevenue = useMemo(() => {
    return series.reduce((sum, item) => sum + item.revenue_cents, 0);
  }, [series]);

  const totalOrders = useMemo(() => {
    return series.reduce((sum, item) => sum + item.orders, 0);
  }, [series]);

  const revenueVariation = useMemo(() => {
    return getVariationPercent(currentSummary.revenue_cents, previousSummary.revenue_cents);
  }, [currentSummary, previousSummary]);

  const ordersVariation = useMemo(() => {
    return getVariationPercent(currentSummary.orders, previousSummary.orders);
  }, [currentSummary, previousSummary]);

  const currentAverageTicket = useMemo(() => {
    if (currentSummary.orders <= 0) return 0;
    return Math.round(currentSummary.revenue_cents / currentSummary.orders);
  }, [currentSummary]);

  const previousAverageTicket = useMemo(() => {
    if (previousSummary.orders <= 0) return 0;
    return Math.round(previousSummary.revenue_cents / previousSummary.orders);
  }, [previousSummary]);

  const ticketVariation = useMemo(() => {
    return getVariationPercent(currentAverageTicket, previousAverageTicket);
  }, [currentAverageTicket, previousAverageTicket]);

  return (
    <AdminShell
      title="Financeiro"
      subtitle="Visão de faturamento e desempenho por período."
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
              Indicadores financeiros
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              Faturamento por dia
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-sm font-medium text-slate-600">Período</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none"
            >
              {rangeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="ml-2 text-sm font-medium text-slate-600">Loja</label>
            {ownerMode ? (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none"
              >
                <option value="">Todas as lojas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                {stores.find((store) => store.id === (currentStoreId || selectedStoreId))?.name ||
                  "Minha loja"}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Faturamento no período</div>
            <div className="mt-2 text-2xl font-black text-slate-900 xl:text-3xl">
              {loading ? "..." : moneyFromCents(totalRevenue)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Pedidos no período</div>
            <div className="mt-2 text-2xl font-black text-slate-900 xl:text-3xl">
              {loading ? "..." : totalOrders}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Média por dia</div>
            <div className="mt-2 text-2xl font-black text-slate-900 xl:text-3xl">
              {loading
                ? "..."
                : moneyFromCents(series.length ? Math.round(totalRevenue / series.length) : 0)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Comparação de faturamento
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {loading ? "..." : getVariationLabel(revenueVariation)}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Atual: {moneyFromCents(currentSummary.revenue_cents)} • Anterior: {moneyFromCents(previousSummary.revenue_cents)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Comparação de pedidos
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {loading ? "..." : getVariationLabel(ordersVariation)}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Atual: {currentSummary.orders} • Anterior: {previousSummary.orders}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Ticket médio comparado
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {loading ? "..." : getVariationLabel(ticketVariation)}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Atual: {moneyFromCents(currentAverageTicket)} • Anterior: {moneyFromCents(previousAverageTicket)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 xl:text-lg">Gráfico diário</h3>
              <p className="mt-1 text-sm text-slate-500">
                Faturamento por dia no período selecionado.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
              Carregando gráfico...
            </div>
          ) : series.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
              Nenhum dado encontrado para este período.
            </div>
          ) : (
            <>
              <div className="grid h-[280px] grid-cols-1 items-end xl:h-[320px]">
                <div className="flex h-full items-end gap-2 overflow-x-auto rounded-2xl bg-slate-50 p-3">
                  {series.map((point) => {
                    const height =
                      maxRevenue > 0
                        ? Math.max(12, Math.round((point.revenue_cents / maxRevenue) * 220))
                        : 12;

                    return (
                      <div
                        key={point.date}
                        className="flex min-w-[64px] flex-col items-center justify-end gap-1.5 xl:min-w-[72px]"
                        title={`${point.label} • ${moneyFromCents(point.revenue_cents)} • ${point.orders} pedido(s)`}
                      >
                        <div className="text-[11px] font-semibold text-slate-500">
                          {moneyFromCents(point.revenue_cents)}
                        </div>

                        <div
                          className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#fb923c,#f97316)]"
                          style={{ height: `${height}px` }}
                        />

                        <div className="text-xs font-bold text-slate-700">
                          {point.label}
                        </div>

                        <div className="text-[11px] text-slate-500">
                          {point.orders} ped.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {series.map((point) => (
                  <div
                    key={point.date}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {point.label}
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900">
                      {moneyFromCents(point.revenue_cents)}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {point.orders} pedido(s)
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-base font-black text-slate-900 xl:text-lg">Ranking de lojas</h3>
            <p className="mt-1 text-sm text-slate-500">
              Lojas ordenadas por faturamento no período selecionado.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
              Carregando ranking...
            </div>
          ) : ranking.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
              Nenhuma loja com faturamento neste período.
            </div>
          ) : (
            <div className="space-y-2.5">
              {ranking.map((store, index) => (
                <div
                  key={store.storeId}
                  className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-xs font-black text-orange-700">
                      #{index + 1}
                    </div>

                    <div>
                      <div className="text-sm font-black text-slate-900 xl:text-base">
                        {store.storeName}
                      </div>
                      <div className="text-sm text-slate-500">
                        {store.orders} pedido(s) • ticket médio {moneyFromCents(store.average_ticket_cents)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-slate-900 xl:text-lg">
                      {moneyFromCents(store.revenue_cents)}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Faturamento
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
