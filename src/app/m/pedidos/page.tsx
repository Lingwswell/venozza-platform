"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalOrderCodes } from "@/lib/local-orders";

type Order = {
  orderCode: string;
  status: string;
  total?: number;
  total_cents?: number;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  novo: "Recebido",
  confirmado: "Confirmado",
  preparo: "Em preparo",
  forno: "No forno",
  pronto: "Pronto",
  saiu_entrega: "Saiu para entrega",
  finalizado: "Finalizado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function moneyFromOrder(order: Order) {
  const value =
    typeof order.total === "number"
      ? order.total
      : typeof order.total_cents === "number"
        ? order.total_cents / 100
        : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function normalizeOrder(payload: any): Order | null {
  const raw = payload?.order || payload?.data || payload;

  if (!raw?.orderCode) return null;

  return {
    orderCode: String(raw.orderCode),
    status: String(raw.status || "novo"),
    total:
      typeof raw.total === "number"
        ? raw.total
        : typeof raw.total_cents === "number"
          ? raw.total_cents / 100
          : 0,
    total_cents: typeof raw.total_cents === "number" ? raw.total_cents : undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function persistValidOrderCodes(orders: Order[]) {
  if (typeof window === "undefined") return;

  const codes = orders
    .map((order) => order.orderCode)
    .filter(Boolean);

  window.localStorage.setItem(
    "venozza_local_order_codes",
    JSON.stringify(codes)
  );

  window.localStorage.setItem(
    "venozza_order_codes",
    JSON.stringify(codes)
  );

  window.localStorage.setItem(
    "venozza_order_history",
    JSON.stringify(
      orders.map((order) => ({
        id: order.orderCode,
        orderCode: order.orderCode,
        order_code: order.orderCode,
        status: order.status,
        total: order.total,
        total_cents: order.total_cents,
        createdAt: order.createdAt,
        saved_at: new Date().toISOString(),
      }))
    )
  );
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const codes = getLocalOrderCodes();

        console.log("[mobile][pedidos] local order codes:", codes);

        if (codes.length === 0) {
          setOrders([]);
          return;
        }

        const loaded = await Promise.all(
          codes.map(async (code) => {
            try {
              const res = await fetch(`/api/orders/${encodeURIComponent(code)}`, {
                cache: "no-store",
              });

              const data = await res.json().catch(() => ({}));

              if (res.status === 404) {
                return null;
              }

              if (!res.ok || data?.ok === false) {
                console.warn(
                  "[mobile][pedidos] erro ao carregar pedido:",
                  code,
                  data
                );
                return null;
              }

              return normalizeOrder(data);
            } catch (error) {
              console.warn("[mobile][pedidos] erro ao carregar:", code, error);
              return null;
            }
          })
        );

        const validOrders = loaded.filter(Boolean) as Order[];

        persistValidOrderCodes(validOrders);
        setOrders(validOrders);
      } catch (error) {
        console.warn("[mobile][pedidos] erro geral:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f1ef] pb-28 text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Pedidos</h1>
            <p className="text-sm text-[#6b6b6b]">Acompanhe seus pedidos</p>
          </div>

          <Link href="/m" className="text-sm font-black text-[#ff1010]">
            Voltar
          </Link>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#666]">Carregando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#666]">Você ainda não tem pedidos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.orderCode}
                href={`/m/s/${order.orderCode}`}
                className="block rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#999]">
                      Número do pedido
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[#171717]">
                      #{order.orderCode}
                    </h2>
                  </div>

                  <span className="rounded-full bg-[#fff1f1] px-3 py-1 text-xs font-black text-[#ff1010]">
                    {statusLabel[order.status] || order.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[#666]">
                    {new Date(order.createdAt).toLocaleString("pt-BR")}
                  </span>
                  <span className="font-black text-[#171717]">
                    {moneyFromOrder(order)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
