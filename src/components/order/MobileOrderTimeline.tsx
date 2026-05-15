type Step = {
  key: string;
  label: string;
};

const steps: Step[] = [
  { key: "novo", label: "Pedido recebido" },
  { key: "preparo", label: "Em preparo" },
  { key: "pronto", label: "Pronto" },
  { key: "saiu_entrega", label: "Saiu para entrega" },
  { key: "entregue", label: "Entregue" },
];

function getCurrentIndex(status: string) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "finalizado" || normalized === "entregue") {
    return steps.length - 1;
  }

  const idx = steps.findIndex((item) => item.key === normalized);
  return idx >= 0 ? idx : 0;
}

export default function MobileOrderTimeline({ status }: { status: string }) {
  const currentIndex = getCurrentIndex(status);

  return (
    <div className="space-y-5">
      {steps.map((step, index) => {
        const done = index <= currentIndex;
        const current = index === currentIndex;
        const last = index === steps.length - 1;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold",
                  done
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-400",
                ].join(" ")}
              >
                {done ? "✓" : index + 1}
              </div>

              {!last ? (
                <div
                  className={[
                    "mt-1 h-10 w-[2px]",
                    done ? "bg-red-600" : "bg-neutral-200",
                  ].join(" ")}
                />
              ) : null}
            </div>

            <div className="pt-1">
              <p
                className={[
                  "text-[15px] font-semibold",
                  done ? "text-neutral-900" : "text-neutral-400",
                ].join(" ")}
              >
                {step.label}
              </p>

              {current ? (
                <p className="text-xs font-semibold text-red-600">Etapa atual</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
