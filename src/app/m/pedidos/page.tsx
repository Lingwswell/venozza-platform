"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  orderId: string;
  status: string;
  total: number;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  novo: "Recebido",
  confirmado: "Confirmado",
  preparo: "Em preparo",
  forno: "No forno",
  pronto: "Pronto",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        const data = await res.json();

        if (res.ok && data?.ok && Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else {
          setOrders([]);
        }
      } catch {
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
                key={order.orderId}
                href={`/m/s/${order.orderId}`}
                className="block rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#999]">
                      Número do pedido
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[#171717]">
                      #{order.orderId}
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
                    {money(order.total)}
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
