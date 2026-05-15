"use client";

import { useEffect, useState } from "react";
import OrderStatusTracker from "@/components/order/OrderStatusTracker";

type OrderItem = {
  id: number | string;
  name: string;
  quantity: number;
  price?: number;
};

type OrderData = {
  orderCode: string;
  customerName: string;
  phone?: string;
  address?: string;
  notes?: string;
  total: number;
  paymentMethod?: string;
  status: string;
  createdAt?: string;
  items: OrderItem[];
};

const statusLabels: Record<string, string> = {
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

export default function AcompanharPedidoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const [codigo, setCodigo] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function load() {
      try {
        const resolved = await params;
        setCodigo(resolved.codigo);

        const res = await fetch(`/api/orders/${resolved.codigo}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Pedido não encontrado");
        }

        const data = await res.json();
        setOrder(data.order);
        setError("");
      } catch (err) {
        setError("Não foi possível carregar o pedido.");
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }

    load();
    intervalId = setInterval(load, 10000);

    return () => clearInterval(intervalId);
  }, [params]);

  return (
    <main className="min-h-screen bg-[#f8f5ef] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl bg-neutral-900 p-6 text-white shadow-lg">
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-300">
            Acompanhamento
          </p>
          <h1 className="mt-2 text-3xl font-bold">Seu pedido</h1>
          <p className="mt-2 text-neutral-300">
            Código: <span className="font-semibold text-white">{codigo}</span>
          </p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-neutral-600">Carregando pedido...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-red-600">{error}</p>
          </div>
        ) : order ? (
          <>
            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-neutral-500">Status atual</p>
                <h2 className="mt-1 text-2xl font-bold text-neutral-900">
                  {statusLabels[order.status] || order.status}
                </h2>

                <div className="mt-4 space-y-2 text-sm text-neutral-600">
                  <p>
                    <span className="font-medium text-neutral-900">Cliente:</span>{" "}
                    {order.customerName}
                  </p>
                  {order.address ? (
                    <p>
                      <span className="font-medium text-neutral-900">Endereço:</span>{" "}
                      {order.address}
                    </p>
                  ) : null}
                  {order.paymentMethod ? (
                    <p>
                      <span className="font-medium text-neutral-900">Pagamento:</span>{" "}
                      {order.paymentMethod}
                    </p>
                  ) : null}
                  {order.notes ? (
                    <p>
                      <span className="font-medium text-neutral-900">Observações:</span>{" "}
                      {order.notes}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-neutral-500">Resumo</p>
                <h2 className="mt-1 text-2xl font-bold text-neutral-900">
                  {money(order.total)}
                </h2>

                <div className="mt-4 border-t border-neutral-200 pt-4">
                  <p className="mb-3 font-semibold text-neutral-900">Itens</p>
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div>
                          <p className="font-medium text-neutral-900">
                            {item.quantity}x {item.name}
                          </p>
                        </div>
                        {typeof item.price === "number" ? (
                          <p className="text-neutral-600">{money(item.price)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {order.status !== "cancelado" ? (
              <OrderStatusTracker status={order.status} />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-red-600">
                  Pedido cancelado
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Esse pedido foi cancelado. Caso precise, entre em contato com a loja.
                </p>
              </div>
            )}

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-neutral-500">
                Atualização automática a cada 10 segundos.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
