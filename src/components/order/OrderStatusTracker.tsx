type OrderStep = {
  key: string;
  label: string;
};

const steps: OrderStep[] = [
  { key: "novo", label: "Pedido recebido" },
  { key: "confirmado", label: "Pedido confirmado" },
  { key: "preparo", label: "Em preparo" },
  { key: "forno", label: "No forno" },
  { key: "pronto", label: "Pronto" },
  { key: "saiu_entrega", label: "Saiu para entrega" },
  { key: "entregue", label: "Entregue" },
];

// Retirada na loja: nao tem "saiu para entrega".
const pickupSteps: OrderStep[] = [
  { key: "novo", label: "Pedido recebido" },
  { key: "preparo", label: "Em preparo" },
  { key: "pronto", label: "Pronto para retirar" },
  { key: "finalizado", label: "Retirado" },
];

function getStepIndex(list: OrderStep[], status: string) {
  // "finalizado" e o ultimo passo nos dois fluxos.
  const key = status === "finalizado" && list === steps ? "entregue" : status;
  const idx = list.findIndex((step) => step.key === key);
  return idx === -1 ? 0 : idx;
}

export default function OrderStatusTracker({ status, orderType }: { status: string; orderType?: string | null }) {
  const list = orderType === "retirada" ? pickupSteps : steps;
  const currentIndex = getStepIndex(list, status);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">
        Andamento do pedido
      </h2>

      <div className="space-y-4">
        {list.map((step, index) => {
          const done = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold",
                    done
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 bg-white text-neutral-400",
                  ].join(" ")}
                >
                  {index + 1}
                </div>
                {index < list.length - 1 ? (
                  <div
                    className={[
                      "mt-1 h-8 w-px",
                      done ? "bg-neutral-900" : "bg-neutral-300",
                    ].join(" ")}
                  />
                ) : null}
              </div>

              <div className="pt-1">
                <p
                  className={[
                    "font-medium",
                    done ? "text-neutral-900" : "text-neutral-400",
                  ].join(" ")}
                >
                  {step.label}
                </p>
                {isCurrent ? (
                  <p className="text-sm text-neutral-500">Status atual</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
