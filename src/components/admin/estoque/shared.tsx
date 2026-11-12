"use client";

// Pecas comuns das telas de estoque.

export { formatQuantity, UNIT_LABELS, costOf, costUnitLabel } from "@/lib/stock/consumption";

export function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-orange-400";

export const cardClass = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";

export const primaryButton =
  "rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60";

export const ghostButton =
  "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60";

/** Unidade "grande" de cada unidade base (para digitar 2 kg em vez de 2000 g). */
export function bigUnit(unit: string) {
  return unit === "g" ? "kg" : unit === "ml" ? "L" : null;
}

/** Texto digitado ("1,5") + unidade escolhida -> quantidade na unidade base. */
export function toBase(text: string, unit: string, big: boolean): number {
  const raw = String(text).trim();
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  if (!Number.isFinite(n)) return NaN;
  return big && bigUnit(unit) ? n * 1000 : n;
}

/** Quantidade base -> texto para editar (usa kg/L quando fica redondo). */
export function fromBase(value: number | null | undefined, unit: string): { text: string; big: boolean } {
  if (value === null || value === undefined) return { text: "", big: false };
  const big = !!bigUnit(unit) && Math.abs(value) >= 1000;
  const shown = big ? value / 1000 : value;
  return { text: String(Math.round(shown * 1000) / 1000).replace(".", ","), big };
}

export function QtyInput({
  unit,
  text,
  big,
  onText,
  onBig,
  placeholder,
  ariaLabel,
}: {
  unit: string;
  text: string;
  big: boolean;
  onText: (v: string) => void;
  onBig: (v: boolean) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const large = bigUnit(unit);
  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={(e) => onText(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={inputClass}
      />
      {large ? (
        <select
          value={big ? "big" : "base"}
          onChange={(e) => onBig(e.target.value === "big")}
          aria-label="Unidade"
          className="rounded-2xl border border-slate-200 px-3 text-sm font-bold"
        >
          <option value="base">{unit}</option>
          <option value="big">{large}</option>
        </select>
      ) : (
        <span className="flex items-center px-2 text-sm font-bold text-slate-500">{unit}</span>
      )}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      className={[
        "rounded-2xl px-4 py-3 text-sm font-semibold",
        kind === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      {children}
    </p>
  );
}

export const MOVEMENT_LABELS: Record<string, string> = {
  entrada: "Entrada",
  venda: "Venda",
  estorno: "Pedido cancelado",
  ajuste: "Acerto",
  contagem: "Contagem",
  perda: "Perda",
  abastecimento: "Abastecimento",
};

export const SUPPLY_STATUS: Record<string, { text: string; className: string }> = {
  aberto: { text: "Aguardando a central", className: "bg-amber-100 text-amber-700" },
  separando: { text: "Central separando", className: "bg-sky-100 text-sky-700" },
  enviado: { text: "A caminho", className: "bg-violet-100 text-violet-700" },
  recebido: { text: "Recebido", className: "bg-emerald-100 text-emerald-700" },
  cancelado: { text: "Cancelado", className: "bg-slate-100 text-slate-500" },
};
