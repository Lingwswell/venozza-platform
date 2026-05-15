"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type RangeKey =
  | "today"
  | "yesterday"
  | "last7days"
  | "thisMonth"
  | "lastMonth"
  | "custom";

type DashboardMetrics = {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  operational_orders: number;
  revenue_cents: number;
  average_ticket_cents: number;
};

type StoreOption = {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
};

type StoresResponse = {
  ok: boolean;
  role?: string;
  currentStoreId?: string | null;
  stores?: StoreOption[];
  error?: string;
};

function moneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value || 0) / 100);
}

function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "last7days", label: "7 dias" },
  { key: "thisMonth", label: "Este mês" },
  { key: "lastMonth", label: "Mês passado" },
  { key: "custom", label: "Personalizado" },
];

const quickModules = [
  {
    title: "Pedidos",
    desc: "Acompanhe pedidos em andamento, atrasos e fluxo operacional.",
    href: "/admin/pedidos",
    icon: "🧾",
  },
  {
    title: "Produtos",
    desc: "Gerencie catálogo, preços, disponibilidade e categorias.",
    href: "/admin/produtos",
    icon: "🍕",
  },
  {
    title: "Financeiro",
    desc: "Veja indicadores, fechamento e visão de receita.",
    href: "/admin/financeiro",
    icon: "💰",
  },
  {
    title: "Lojas",
    desc: "Centralize unidades, operação e expansão multi-loja.",
    href: "/admin/lojas",
    icon: "🏬",
  },
  {
    title: "KDS Central",
    desc: "Acompanhe operação multi-loja em tempo real.",
    href: "/admin/kds",
    icon: "🍳",
  },
  {
    title: "KDS Loja",
    desc: "Abra o painel operacional local da cozinha.",
    href: "/kds",
    icon: "📺",
  },
];

export default function AdminDashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const [role, setRole] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const [customStart, setCustomStart] = useState(todayInputValue());
  const [customEnd, setCustomEnd] = useState(todayInputValue());
  const [appliedCustomStart, setAppliedCustomStart] = useState(todayInputValue());
  const [appliedCustomEnd, setAppliedCustomEnd] = useState(todayInputValue());

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    operational_orders: 0,
    revenue_cents: 0,
    average_ticket_cents: 0,
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

    async function loadMetrics() {
      try {
        setLoadingMetrics(true);

        const params = new URLSearchParams();
        params.set("range", range);

        if (range === "custom") {
          params.set("start", appliedCustomStart);
          params.set("end", appliedCustomEnd);
        }

        const effectiveStoreId =
          String(role).toLowerCase() === "owner"
            ? selectedStoreId
            : currentStoreId || selectedStoreId;

        if (effectiveStoreId) {
          params.set("storeId", effectiveStoreId);
        }

        const res = await fetchWithAuth(`/api/admin/dashboard/metrics?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || !data?.ok || cancelled) return;

        setMetrics({
          total_orders: Number(data.metrics?.total_orders || 0),
          delivered_orders: Number(data.metrics?.delivered_orders || 0),
          cancelled_orders: Number(data.metrics?.cancelled_orders || 0),
          operational_orders: Number(data.metrics?.operational_orders || 0),
          revenue_cents: Number(data.metrics?.revenue_cents || 0),
          average_ticket_cents: Number(data.metrics?.average_ticket_cents || 0),
        });
      } catch {
        if (!cancelled) {
          setMetrics({
            total_orders: 0,
            delivered_orders: 0,
            cancelled_orders: 0,
            operational_orders: 0,
            revenue_cents: 0,
            average_ticket_cents: 0,
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingMetrics(false);
        }
      }
    }

    loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [range, appliedCustomStart, appliedCustomEnd, selectedStoreId, currentStoreId, role]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Pedidos",
        value: loadingMetrics ? "..." : String(metrics.total_orders),
        hint: "Quantidade real no período selecionado",
        icon: "🧾",
      },
      {
        label: "Faturamento",
        value: loadingMetrics ? "..." : moneyFromCents(metrics.revenue_cents),
        hint: "Soma real dos pedidos não cancelados",
        icon: "💰",
      },
      {
        label: "Ticket médio",
        value: loadingMetrics ? "..." : moneyFromCents(metrics.average_ticket_cents),
        hint: "Média real do período",
        icon: "📈",
      },
      {
        label: "Em andamento",
        value: loadingMetrics ? "..." : String(metrics.operational_orders),
        hint: "Pedidos ainda em operação",
        icon: "🏬",
      },
    ],
    [metrics, loadingMetrics]
  );

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) return;
    setAppliedCustomStart(customStart);
    setAppliedCustomEnd(customEnd);
  }

  const ownerMode = String(role).toLowerCase() === "owner";

  return (
    <AdminShell
      title="Dashboard profissional"
      subtitle="Visão executiva da operação VenoZza no ambiente de desenvolvimento."
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
              Indicadores
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">
              Resumo do período
            </h3>
          </div>

          <div className="flex flex-col items-start gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-slate-600">Período</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none"
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
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none"
                >
                  <option value="">Todas as lojas</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                  {stores.find((store) => store.id === (currentStoreId || selectedStoreId))?.name ||
                    "Minha loja"}
                </div>
              )}
            </div>

            {range === "custom" ? (
              <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Início
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fim
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd || customStart > customEnd}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Aplicar
                </button>

                {customStart > customEnd ? (
                  <span className="text-xs font-semibold text-red-600">
                    A data inicial não pode ser maior que a final.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 xl:text-3xl">
                    {card.value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{card.hint}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-xl">
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                  Visão geral
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  Centro de comando da operação
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Essa área será a base para pedidos, expedição, financeiro, multi-loja,
                  catálogo, campanhas e monitoramento operacional.
                </p>
              </div>

              <div className="hidden rounded-3xl bg-slate-900 px-5 py-4 text-white lg:block">
                <p className="text-xs uppercase tracking-[0.25em] text-orange-300">
                  Status
                </p>
                <p className="mt-2 text-lg font-bold">Operação monitorada</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {quickModules.map((module) => (
                <Link
                  key={module.title}
                  href={module.href}
                  className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-orange-300 hover:bg-orange-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl">{module.icon}</p>
                      <h4 className="mt-3 text-lg font-black text-slate-900">
                        {module.title}
                      </h4>
                      <p className="mt-2 text-sm text-slate-500">{module.desc}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm group-hover:text-orange-600">
                      Abrir
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                Prioridades
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-900">
                Próximos passos do admin
              </h3>

              <div className="mt-5 space-y-4">
                {[
                  "Criar módulos reais de pedidos e catálogo",
                  "Implementar menu lateral com páginas funcionais",
                  "Ligar métricas reais do banco",
                  "Preparar base multi-loja e permissões",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <span className="mt-0.5 text-orange-600">●</span>
                    <p className="text-sm text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#1e293b,#0f172a)] p-5 text-white shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">
                Ambiente atual
              </p>
              <h3 className="mt-2 text-2xl font-black">Desenvolvimento</h3>
              <p className="mt-3 text-sm text-slate-300">
                Todas as alterações estão sendo trabalhadas apenas no DEV,
                sem impactar produção.
              </p>
              <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200">
                URL base: http://192.168.15.15:3000
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
