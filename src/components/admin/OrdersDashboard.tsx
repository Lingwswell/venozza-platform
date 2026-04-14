"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type Order = {
  id: string;
  orderCode: string;
  customerName: string;
  phone: string;
  address: string;
  total: number;
  total_cents: number;
  status: string;
  store_id: string | number | null;
  store_name: string | null;
  createdAt: string;
};

type OrdersResponse = {
  ok: boolean;
  orders?: Order[];
  error?: string;
  scope?: {
    tenantId?: string | null;
    storeId?: string | null;
  };
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadOrders() {
    if (loadingRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    loadingRef.current = true;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (mountedRef.current) {
        setError("");
      }

      const res = await fetchWithAuth("/api/orders", {
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
      if (controller.signal.aborted) {
        return;
      }

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
    loadOrders();

    const interval = window.setInterval(() => {
      loadOrders();
    }, 15000);

    const handleVisibility = () => {
      if (!document.hidden) {
        loadOrders();
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
  }, []);

  const totalOrders = orders.length;

  const revenue = useMemo(() => {
    return orders.reduce((sum, order) => sum + (order.total || 0), 0);
  }, [orders]);

  const byStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const order of orders) {
      acc[order.status] = (acc[order.status] || 0) + 1;
    }
    return acc;
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Pedidos</h2>
          <p className="mt-1 text-sm text-white/60">
            Dados reais carregados da API protegida.
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5 text-sm text-white/70">
          Carregando pedidos...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <div className="text-sm text-white/60">Total de pedidos</div>
              <div className="mt-2 text-3xl font-bold">{totalOrders}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <div className="text-sm text-white/60">Faturamento</div>
              <div className="mt-2 text-3xl font-bold">{money(revenue)}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <div className="text-sm text-white/60">Pedidos novos</div>
              <div className="mt-2 text-3xl font-bold">{byStatus["novo"] || 0}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
              <div className="text-sm text-white/60">Status únicos</div>
              <div className="mt-2 text-3xl font-bold">
                {Object.keys(byStatus).length}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <h3 className="text-lg font-semibold">Pedidos por status</h3>

            <div className="mt-4 flex flex-wrap gap-3">
              {Object.keys(byStatus).length ? (
                Object.entries(byStatus).map(([status, count]) => (
                  <div
                    key={status}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold">{status}</span>: {count}
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/60">
                  Nenhum status encontrado.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <h3 className="text-lg font-semibold">Últimos pedidos</h3>

            <div className="mt-4 space-y-3">
              {orders.length ? (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold">#{order.orderCode}</div>
                        <div className="text-sm text-white/60">
                          {order.customerName} • {order.phone}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold">{money(order.total)}</div>
                        <div className="text-sm text-white/60">{order.status}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-white/70 md:grid-cols-3">
                      <div>
                        <span className="text-white/50">Loja:</span>{" "}
                        {order.store_name || order.store_id || "-"}
                      </div>
                      <div>
                        <span className="text-white/50">Endereço:</span>{" "}
                        {order.address || "-"}
                      </div>
                      <div>
                        <span className="text-white/50">Criado em:</span>{" "}
                        {new Date(order.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/60">
                  Nenhum pedido encontrado.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
