"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  decrementCartItem,
  getCartItemsByStore,
  incrementCartItem,
  removeCartItem,
} from "@/lib/cart-storage";
import type { CartItem } from "@/types/order";
import { getMobileStoreContext } from "@/lib/mobile-store-context";

function moneyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CarrinhoPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  function reloadCart() {
    const store = getMobileStoreContext();
    const cart = getCartItemsByStore(store.storeId);
    setItems(Array.isArray(cart) ? cart : []);
  }

  useEffect(() => {
    reloadCart();

    const onFocus = () => reloadCart();
    const onStorage = () => reloadCart();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.price_cents || 0) * Number(item.quantity || 0);
    }, 0);
  }, [items]);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [items]);

  return (
    <main className="min-h-screen bg-[#f6eded] px-4 py-6 pb-32">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold text-neutral-950">Carrinho</h1>
            <p className="text-neutral-500">Confira seus itens antes do checkout</p>
          </div>

          <Link href="/m" className="shrink-0 text-sm font-extrabold text-red-600">
            Voltar
          </Link>
        </div>

        {!items.length ? (
          <div className="rounded-[28px] border border-neutral-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-neutral-950">
              Seu carrinho está vazio
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Adicione pizzas, bebidas e acompanhamentos para continuar.
            </p>

            <Link
              href="/m"
              className="mt-5 inline-flex rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              Voltar ao menu
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item, index) => {
                const unitCents = Number(item.price_cents || 0);
                const itemTotalCents = unitCents * Number(item.quantity || 0);

                return (
                  <section
                    key={`${item.id}-${index}`}
                    className="rounded-[28px] border border-neutral-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                            sem foto
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="break-words text-lg font-extrabold leading-tight text-neutral-950">
                              {item.name}
                            </h2>

                            {item.size ? (
                              <p className="mt-1 text-xs font-bold text-neutral-500">
                                Tamanho: {item.size}
                              </p>
                            ) : null}

                            {item.addons && item.addons.length > 0 ? (
                              <p className="mt-1 break-words text-xs leading-5 text-neutral-500">
                                Adicionais: {item.addons.join(", ")}
                              </p>
                            ) : null}

                            {item.note ? (
                              <p className="mt-1 break-words text-xs font-semibold text-red-600">
                                Obs: {item.note}
                              </p>
                            ) : null}
                          </div>

                          <button
                            onClick={() => {
                              removeCartItem(item.id);
                              reloadCart();
                            }}
                            className="shrink-0 text-sm font-bold text-red-600"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-2 py-1">
                        <button
                          onClick={() => {
                            decrementCartItem(item.id);
                            reloadCart();
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-extrabold text-neutral-700"
                        >
                          -
                        </button>

                        <span className="min-w-6 text-center text-sm font-extrabold text-neutral-900">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => {
                            incrementCartItem(item.id);
                            reloadCart();
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-extrabold text-neutral-700"
                        >
                          +
                        </button>
                      </div>

                      <div className="min-w-0 text-right">
                        <p className="text-xs font-semibold text-neutral-400">
                          Unitário {moneyFromCents(unitCents)}
                        </p>
                        <p className="text-xl font-extrabold leading-tight text-neutral-950">
                          {moneyFromCents(itemTotalCents)}
                        </p>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="mt-5 rounded-[28px] border border-neutral-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-500">Itens</span>
                <span className="text-sm font-extrabold text-neutral-900">
                  {totalItems}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-base font-semibold text-neutral-500">
                  Subtotal
                </span>
                <span className="break-words text-right text-2xl font-extrabold text-neutral-950">
                  {moneyFromCents(subtotal)}
                </span>
              </div>

              <Link
                href="/m/checkout"
                className="mt-5 flex w-full items-center justify-center rounded-full bg-red-600 px-5 py-4 text-sm font-extrabold text-white shadow-sm"
              >
                Ir para checkout
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
