"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const mockOrder = {
  id: "VZ-0014",
  status: "recebido",
  items: [
    { name: "Atum", qty: 6 },
  ],
  total: 332.0,
};

const steps = [
  { key: "recebido", label: "Pedido recebido" },
  { key: "preparo", label: "Em preparo" },
  { key: "forno", label: "No forno" },
  { key: "pronto", label: "Pronto" },
  { key: "saiu_entrega", label: "Saiu para entrega" },
  { key: "entregue", label: "Entregue" },
];

const statusOrder = [
  "recebido",
  "preparo",
  "forno",
  "pronto",
  "saiu_entrega",
  "entregue",
];

export default function PedidoDetalhePage() {
  const params = useParams();
  const id = String(params?.id || mockOrder.id);

  const currentIndex = statusOrder.indexOf(mockOrder.status);

  return (
    <main className="min-h-screen bg-[#f6eded] px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="mb-4">
          <Link
            href="/m/pedidos"
            className="inline-flex rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm"
          >
            ← Voltar
          </Link>
        </div>

        <section className="rounded-[28px] bg-white p-5 shadow-sm border border-neutral-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Acompanhamento
          </p>

          <h1 className="mt-1 text-2xl font-extrabold text-red-600">
            {id}
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Acompanhe o andamento do seu pedido em tempo real.
          </p>

          <div className="mt-6 space-y-4">
            {steps.map((step, index) => {
              const done = index <= currentIndex;
              const active = index === currentIndex;

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full border-2",
                      done
                        ? "border-red-500 bg-red-500"
                        : "border-neutral-300 bg-white",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "h-2 w-2 rounded-full",
                        done ? "bg-white" : "bg-neutral-300",
                      ].join(" ")}
                    />
                  </div>

                  <div className="flex-1">
                    <p
                      className={[
                        "text-sm font-semibold",
                        active
                          ? "text-red-600"
                          : done
                          ? "text-neutral-800"
                          : "text-neutral-400",
                      ].join(" ")}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-[#faf7f7] p-4">
            <p className="text-sm font-bold text-neutral-800">Itens do pedido</p>

            <div className="mt-3 space-y-2 text-sm text-neutral-600">
              {mockOrder.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span>x{item.qty}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-500">Total</span>
              <span className="text-lg font-extrabold text-neutral-900">
                {mockOrder.total.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
