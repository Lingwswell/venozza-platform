"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import type { CartItem } from "@/types/order";
import { cartLineKey, changeCartLineQuantity } from "@/lib/cart-storage";
import type { StoreCatalog } from "@/lib/catalog/use-store-catalog";
import { computeDeliveryFeeCents, DEFAULT_STORE_SETTINGS } from "@/lib/store/settings-shared";
import { displayFont } from "@/lib/fonts";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Carrinho lateral do site (desktop). Usa o mesmo carrinho do app.
export default function SiteCart({
  items,
  catalog,
}: {
  items: CartItem[];
  catalog: StoreCatalog | null;
}) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price_cents || 0) * i.quantity, 0);
  const settings = catalog ? { ...DEFAULT_STORE_SETTINGS, ...catalog.settings } : null;
  const fee = settings ? computeDeliveryFeeCents(settings, subtotal) : 0;
  const minimum = settings?.minimumOrderCents || 0;
  const missing = minimum > 0 && subtotal < minimum ? minimum - subtotal : 0;
  const closed = catalog ? !catalog.status.open : false;

  return (
    <div className="rounded-[28px] border border-[#ECE6DF] bg-white p-5">
      <h2 className={`${displayFont.className} text-xl font-bold text-[#1F1A17]`}>Seu pedido</h2>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-[#D9CFC4]" />
          <p className="mt-3 text-sm text-[#6B625B]">Seu carrinho está vazio. Escolha algo do cardápio.</p>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-[#F1ECE6]">
            {items.map((item) => (
              <li key={cartLineKey(item)} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1F1A17]">{item.name}</p>
                    {[item.size, item.crust, ...(item.addons || [])].filter(Boolean).length > 0 ? (
                      <p className="mt-0.5 text-xs text-[#857A71]">
                        {[item.size, item.crust, ...(item.addons || [])].filter(Boolean).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[#1F1A17]">
                    {money(Number(item.price_cents || 0) * item.quantity)}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center rounded-full border border-[#ECE6DF]">
                  <button
                    type="button"
                    onClick={() => changeCartLineQuantity(item, -1)}
                    aria-label={`Tirar um ${item.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full text-[#6B625B] hover:text-[#C8171E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8171E]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeCartLineQuantity(item, 1)}
                    aria-label={`Mais um ${item.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full text-[#6B625B] hover:text-[#C8171E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8171E]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 border-t border-[#ECE6DF] pt-4 text-sm">
            <div className="flex justify-between text-[#6B625B]">
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[#6B625B]">
              <dt>Entrega</dt>
              <dd>{fee > 0 ? money(fee) : "Grátis"}</dd>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold text-[#1F1A17]">
              <dt>Total</dt>
              <dd>{money(subtotal + fee)}</dd>
            </div>
          </dl>

          {closed ? (
            <p className="mt-4 rounded-2xl bg-[#FDEDEC] px-4 py-3 text-sm font-medium text-[#A3141A]">
              {catalog?.status.message}
            </p>
          ) : missing > 0 ? (
            <p className="mt-4 rounded-2xl bg-[#FFF6E0] px-4 py-3 text-sm text-[#7A5600]">
              Faltam {money(missing)} para o pedido mínimo de {money(minimum)}.
            </p>
          ) : null}

          <Link
            href="/m/checkout"
            aria-disabled={closed || missing > 0}
            className={[
              "mt-4 flex items-center justify-center rounded-full px-5 py-3.5 text-sm font-bold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8171E]",
              closed || missing > 0
                ? "pointer-events-none bg-[#D9CFC4]"
                : "bg-[#C8171E] hover:bg-[#A9121A]",
            ].join(" ")}
          >
            Finalizar pedido
          </Link>
        </>
      )}
    </div>
  );
}
