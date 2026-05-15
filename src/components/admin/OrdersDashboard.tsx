"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type OrderItem = {
  id: string;
  productId?: string | null;
  name: string;
  quantity: number;
  price_cents: number;
  total_cents: number;
  note?: string | null;
  size?: string | null;
  crust?: string | null;
  addons?: string[];
};

type Order = {
  id: string;
  orderCode: string;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  total_cents: number;
  subtotal_cents?: number;
  freight_cents?: number;
  paymentMethod?: string;
  notes?: string | null;
  status: string;
  store_id: string | number | null;
  store_name: string | null;
  items?: OrderItem[];
  createdAt: string;
};

type OrdersResponse = {
  ok: boolean;
  orders?: Order[];
  error?: string;
  scope?: {
    requested?: string;
    tenantId?: string | null;
    storeId?: string | null;
  };
};

type ScopeTab = "operational" | "completed" | "cancelled" | "all";

const tabs: { key: ScopeTab; label: string }[] = [
  { key: "operational", label: "Em andamento" },
  { key: "completed", label: "Concluídos" },
  { key: "cancelled", label: "Cancelados" },
  { key: "all", label: "Todos" },
];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function moneyFromCents(cents: number) {
  return money(Number(cents || 0) / 100);
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "novo":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "preparo":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "pronto":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "saiu_entrega":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "finalizado":
    case "entregue":
      return "bg-green-50 text-green-700 border-green-200";
    case "cancelado":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [scope, setScope] = useState<ScopeTab>("operational");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadOrders(nextScope?: ScopeTab) {
    if (loadingRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    loadingRef.current = true;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const effectiveScope = nextScope || scope;

    try {
      if (mountedRef.current) {
        setError("");
      }

      const res = await fetchWithAuth(`/api/orders?scope=${effectiveScope}`, {
        method: "GET",
        signal: controller.signal,
      });

      const data: OrdersResponse = await res.json();

      if (!res.ok || !data.ok) {
        if (mountedRef.current) {
          setError(data.error || "Erro ao carregar pedidos");
          setOrders([]);
        }
        return;
      }

      if (mountedRef.current) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      console.error("[OrdersDashboard][loadOrders]", err);

      if (mountedRef.current) {
        setError("Erro ao carregar pedidos");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    loadOrders(scope);

    const interval = window.setInterval(() => {
      loadOrders(scope);
    }, 15000);

    const handleVisibility = () => {
      if (!document.hidden) {
        loadOrders(scope);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);

      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [scope]);

  const totalOrders = orders.length;

  const revenue = useMemo(() => {
    return orders.reduce((sum, order) => sum + ((order.total_cents || 0) / 100), 0);
  }, [orders]);

  const byStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const order of orders) {
      acc[order.status] = (acc[order.status] || 0) + 1;
    }
    return acc;
  }, [orders]);

  const averageTicket = useMemo(() => {
    if (!orders.length) return 0;
    return revenue / orders.length;
  }, [revenue, orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Dashboard de Pedidos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Separação entre visão operacional e visão gerencial.
          </p>
        </div>

        <button
          onClick={() => loadOrders(scope)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setScope(tab.key);
              setLoading(true);
            }}
            className={[
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              scope === tab.key
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Carregando pedidos...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Total de pedidos</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{totalOrders}</div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Faturamento</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{money(revenue)}</div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Ticket médio</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{money(averageTicket)}</div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Status únicos</div>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {Object.keys(byStatus).length}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Pedidos por status</h3>

            <div className="mt-4 flex flex-wrap gap-3">
              {Object.keys(byStatus).length ? (
                Object.entries(byStatus).map(([status, count]) => (
                  <div
                    key={status}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium ${getStatusBadgeClass(status)}`}
                  >
                    <span className="font-bold">{status}</span>: {count}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">
                  Nenhum status encontrado.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Últimos pedidos</h3>

            <div className="mt-4 space-y-3">
              {orders.length ? (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-900">
                          #{order.orderCode}
                        </div>
                        <div className="text-sm text-slate-600">
                          {order.customerName} • {order.phone}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-slate-900">
                          {moneyFromCents(order.total_cents || 0)}
                        </div>
                        <div
                          className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(order.status)}`}
                        >
                          {order.status}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <div>
                        <span className="font-semibold text-slate-500">Loja:</span>{" "}
                        {order.store_name || order.store_id || "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Endereço:</span>{" "}
                        {order.address || "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Criado em:</span>{" "}
                        {new Date(order.createdAt).toLocaleString("pt-BR")}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Pagamento:</span>{" "}
                        {order.paymentMethod || "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Frete:</span>{" "}
                        {typeof order.freight_cents === "number"
                          ? moneyFromCents(order.freight_cents)
                          : "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Itens:</span>{" "}
                        {order.items?.length || 0}
                      </div>
                    </div>

                    {order.items?.length ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
                          Itens do pedido
                        </div>

                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl bg-slate-50 p-3 text-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="font-black text-slate-900">
                                    {item.quantity}x {item.name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Item: {moneyFromCents(item.total_cents || 0)}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                {item.size ? (
                                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                                    {item.size}
                                  </span>
                                ) : null}

                                {item.crust ? (
                                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                                    {item.crust}
                                  </span>
                                ) : null}

                                {item.addons?.map((addon, index) => (
                                  <span
                                    key={`${item.id}-addon-${index}`}
                                    className="rounded-full bg-slate-200 px-2.5 py-1 font-semibold text-slate-700"
                                  >
                                    {addon}
                                  </span>
                                ))}
                              </div>

                              {item.note ? (
                                <div className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                                  Obs: {item.note}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {order.notes ? (
                      <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-800">
                        <span className="font-bold">Observação do pedido:</span>{" "}
                        {order.notes}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">
                  Nenhum pedido encontrado nesta visão.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
