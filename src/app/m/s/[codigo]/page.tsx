"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MobileOrderTimeline from "@/components/order/MobileOrderTimeline";
import { clearActiveOrderId, setActiveOrderId } from "@/lib/active-order";

type OrderItem = {
  id?: number | string;
  name: string;
  quantity: number;
  price?: number;
};

type OrderData = {
  orderCode: string;
  total?: number;
  total_cents?: number;
  status: string;
  items?: OrderItem[];
};

const statusLabel: Record<string, string> = {
  novo: "Pedido recebido",
  preparo: "Em preparo",
  pronto: "Pronto",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Pedido cancelado",
};

function money(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export default function MobileTrackPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const [codigo, setCodigo] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    async function loadOrder() {
      try {
        const p = await params;
        setCodigo(p.codigo);

        const res = await fetch(`/api/orders/${p.codigo}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (res.ok && data?.order) {
          setOrder(data.order);

          if (data.order.status === "entregue" || data.order.status === "cancelado") {
            clearActiveOrderId();
          } else {
            setActiveOrderId(data.order.orderCode);
          }
        } else {
          setOrder(null);
        }
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
    timer = setInterval(loadOrder, 10000);

    return () => clearInterval(timer);
  }, [params]);

  return (
    <main className="min-h-screen bg-[#f6efef] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[20px] bg-[#f3f3f5] px-5 py-5 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            Número do pedido
          </p>
          <h1 className="mt-2 text-[30px] font-extrabold text-red-600">
            #{codigo}
          </h1>
        </section>

        <section className="rounded-[20px] border border-neutral-200 bg-white px-5 py-6 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            Status atual
          </p>

          <h2 className="mt-3 text-[21px] font-extrabold text-red-600">
            {loading
              ? "Carregando..."
              : order
              ? statusLabel[order.status] || order.status
              : "Pedido não encontrado"}
          </h2>

          {order ? (
            <p className="mt-4 text-[18px] text-neutral-700">
              Total do pedido: {money(typeof order.total_cents === "number" ? order.total_cents / 100 : order.total)}
            </p>
          ) : null}
        </section>

        <section className="rounded-[20px] bg-transparent px-1 py-1">
          <h3 className="mb-4 text-[16px] font-bold text-neutral-800">
            Progresso do pedido
          </h3>

          {order ? (
            <MobileOrderTimeline status={order.status} />
          ) : (
            <div className="rounded-[18px] border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
              Não foi possível carregar o andamento do pedido.
            </div>
          )}
        </section>

        <Link
          href="/m"
          className="flex h-14 items-center justify-center rounded-full border border-neutral-200 bg-white text-[15px] font-bold text-neutral-700 shadow-sm"
        >
          Voltar para o app
        </Link>
      </div>
    </main>
  );
}
