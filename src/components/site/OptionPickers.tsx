"use client";

import { Minus, Plus } from "lucide-react";
import type { CatalogOption } from "@/lib/use-option-catalog";

export function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8171E]";

function priceLabel(cents: number, zeroLabel: string) {
  if (cents > 0) return `+ ${money(cents)}`;
  if (cents < 0) return `- ${money(Math.abs(cents))}`;
  return zeroLabel;
}

/** Grupo de escolha unica (tamanho, borda, massa...). Some se nao houver opcoes. */
export function ChoiceGroup({
  title,
  hint,
  name,
  options,
  value,
  onChange,
  zeroLabel = "Incluso",
}: {
  title: string;
  hint?: string;
  name: string;
  options: CatalogOption[];
  value: string;
  onChange: (id: string) => void;
  zeroLabel?: string;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset className="border-t border-[#ECE6DF] pt-5">
      <legend className="text-base font-semibold text-[#1F1A17]">{title}</legend>
      {hint ? <p className="mt-0.5 text-sm text-[#857A71]">{hint}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label
              key={option.id}
              className={[
                "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-[#C8171E]",
                checked ? "border-[#C8171E] bg-[#FDF2F1]" : "border-[#ECE6DF] hover:border-[#D4C9BE]",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name={name}
                  checked={checked}
                  onChange={() => onChange(option.id)}
                  className="h-4 w-4 accent-[#C8171E]"
                />
                <span className="font-medium text-[#1F1A17]">{option.name}</span>
              </span>
              <span className="whitespace-nowrap text-[#6B625B]">{priceLabel(option.price_cents, zeroLabel)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Bebidas que acompanham a pizza (quantidade de cada). */
export function DrinkCounters({
  options,
  quantities,
  onChange,
}: {
  options: CatalogOption[];
  quantities: Record<string, number>;
  onChange: (id: string, quantity: number) => void;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset className="border-t border-[#ECE6DF] pt-5">
      <legend className="text-base font-semibold text-[#1F1A17]">Bebidas para acompanhar</legend>
      <p className="mt-0.5 text-sm text-[#857A71]">Opcional</p>
      <ul className="mt-3 divide-y divide-[#F1ECE6]">
        {options.map((option) => {
          const qty = quantities[option.id] || 0;
          return (
            <li key={option.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium text-[#1F1A17]">{option.name}</span>
                <span className="ml-2 text-[#6B625B]">{money(option.price_cents)}</span>
              </span>
              <span className="inline-flex items-center rounded-full border border-[#ECE6DF]">
                <button
                  type="button"
                  disabled={qty === 0}
                  onClick={() => onChange(option.id, qty - 1)}
                  aria-label={`Tirar ${option.name}`}
                  className={`${focusRing} grid h-8 w-8 place-items-center rounded-full text-[#6B625B] disabled:opacity-30`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-6 text-center font-semibold">{qty}</span>
                <button
                  type="button"
                  onClick={() => onChange(option.id, qty + 1)}
                  aria-label={`Adicionar ${option.name}`}
                  className={`${focusRing} grid h-8 w-8 place-items-center rounded-full text-[#6B625B]`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Rodape da janela: quantidade + botao com o total. */
export function AddBar({
  quantity,
  onQuantity,
  totalCents,
  disabled,
  onAdd,
  message,
}: {
  quantity: number;
  onQuantity: (q: number) => void;
  totalCents: number;
  disabled?: boolean;
  onAdd: () => void;
  message?: string;
}) {
  return (
    <div className="border-t border-[#ECE6DF] bg-white px-6 py-4">
      {message ? <p className="mb-3 text-sm font-medium text-[#A3141A]">{message}</p> : null}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full border border-[#ECE6DF]">
          <button
            type="button"
            disabled={quantity <= 1}
            onClick={() => onQuantity(quantity - 1)}
            aria-label="Diminuir quantidade"
            className={`${focusRing} grid h-11 w-11 place-items-center rounded-full disabled:opacity-30`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-6 text-center font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantity(quantity + 1)}
            aria-label="Aumentar quantidade"
            className={`${focusRing} grid h-11 w-11 place-items-center rounded-full`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className={`${focusRing} flex flex-1 items-center justify-between rounded-full bg-[#C8171E] px-6 py-3 text-sm font-bold text-white hover:bg-[#A9121A] disabled:bg-[#D9CFC4]`}
        >
          <span>Adicionar ao pedido</span>
          <span>{money(totalCents)}</span>
        </button>
      </div>
    </div>
  );
}
