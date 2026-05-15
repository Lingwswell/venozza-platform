"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearCart,
  decrementCartItem,
  getCartItems,
  getCartItemsByStore,
  incrementCartItem,
  removeCartItem,
} from "@/lib/cart-storage";
import type { CartItem } from "@/types/order";
import { setActiveOrderId } from "@/lib/active-order";
import { formatMoneyFromCents } from "@/lib/utils/formatters";
import { getAuthToken } from "@/lib/auth/token";
import { getMobileStoreContext } from "@/lib/mobile-store-context";
import { saveLocalOrderCode } from "@/lib/local-orders";

export default function MobileCheckoutPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const deliveryFeeCents = 500;

  function loadCart() {
    const mobileStore = getMobileStoreContext();
    const cart = getCartItemsByStore(mobileStore.storeId);

    const safeCart = Array.isArray(cart)
      ? cart.filter(
          (item) =>
            item &&
            typeof item.id !== "undefined" &&
            typeof item.name === "string" &&
            typeof item.price_cents === "number" &&
            typeof item.quantity === "number" &&
            item.quantity > 0 &&
            item.storeId === mobileStore.storeId
        )
      : [];

    setItems(safeCart);
    return safeCart;
  }

  useEffect(() => {
    const safeCart = loadCart();
    setMounted(true);

    if (safeCart.length === 0) {
      setMessage("");
    }
  }, []);

  const subtotalCents = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.price_cents || 0) * Number(item.quantity || 0);
    }, 0);
  }, [items]);

  const finalTotalCents = subtotalCents + (items.length > 0 ? deliveryFeeCents : 0);

  function handleIncrement(id: string | number) {
    incrementCartItem(id);
    setItems(getCartItems());
    setMessage("");
  }

  function handleDecrement(id: string | number) {
    decrementCartItem(id);
    const next = getCartItems();
    setItems(next);
    if (next.length === 0) {
      setMessage("");
    }
  }

  function handleRemove(id: string | number) {
    removeCartItem(id);
    const next = getCartItems();
    setItems(next);
    if (next.length === 0) {
      setMessage("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!items || items.length === 0) {
      setMessage("Seu carrinho está vazio.");
      return;
    }

    if (!customerName.trim()) {
      setMessage("Informe seu nome.");
      return;
    }

    if (!phone.trim()) {
      setMessage("Informe seu telefone.");
      return;
    }

    if (!address.trim()) {
      setMessage("Informe seu endereço.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const token = getAuthToken();
      const mobileStore = getMobileStoreContext();
      const storeId = mobileStore.storeId;
      const tenantId = mobileStore.tenantId;
      console.log("[checkout] tenantId:", tenantId);
      console.log("[checkout] storeId:", storeId);

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-store-id": storeId,
        },
        body: JSON.stringify({
          customerName,
          phone,
          address,
          notes,
          items: items.map((item) => ({
            ...item,
            tenantId,
            storeId,
          })),
          tenantId,
          subtotal: subtotalCents / 100,
          subtotal_cents: subtotalCents,
          deliveryFee: deliveryFeeCents / 100,
          freight_cents: deliveryFeeCents,
          total: finalTotalCents / 100,
          total_cents: finalTotalCents,
          paymentMethod,
          storeId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setMessage(data.error || "Não foi possível finalizar o pedido.");
        return;
      }

      clearCart();
      setItems([]);
      setCustomerName("");
      setPhone("");
      setAddress("");
      setNotes("");
      setPaymentMethod("pix");

      const orderRef = data?.order?.orderCode || data?.order?.id;

      if (orderRef) {
        saveLocalOrderCode(String(orderRef));
      }

      if (!orderRef) {
        setMessage("Pedido criado, mas o identificador de retorno não veio da API.");
        return;
      }

      setActiveOrderId(orderRef);
      window.location.href = `/m/s/${orderRef}`;
    } catch (error) {
      setMessage("Erro ao enviar pedido.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || items.length === 0;

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#f7f1ef] pb-10 text-[#171717]">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <header className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Checkout</h1>
              <p className="text-sm text-[#6b6b6b]">Finalize seu pedido</p>
            </div>

            <Link href="/m" className="text-sm font-black text-[#ff1010]">
              Voltar
            </Link>
          </header>

          <section className="rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-black">Resumo do pedido</h2>
            <p className="text-sm text-[#666]">Carregando carrinho...</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f1ef] pb-10 text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Checkout</h1>
            <p className="text-sm text-[#6b6b6b]">Finalize seu pedido</p>
          </div>

          <Link href="/m" className="text-sm font-black text-[#ff1010]">
            Voltar
          </Link>
        </header>

        <section className="mb-5 rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Resumo do pedido</h2>
            {items.length > 0 ? (
              <span className="text-xs font-bold text-[#777]">
                {items.reduce((acc, item) => acc + item.quantity, 0)} item(ns)
              </span>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-[#666]">Seu carrinho está vazio.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#eee3df] bg-[#fffaf8] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[#202020]">
                        {item.name}
                      </div>
                      <div className="mt-1 text-xs text-[#777]">
                        Unitário: {formatMoneyFromCents(Number(item.price_cents || 0))}
                      </div>

                      {item.addons && item.addons.length > 0 && (
                        <div className="mt-1 text-xs text-[#555]">
                          Adicionais: {item.addons.join(", ")}
                        </div>
                      )}

                      {item.note && (
                        <div className="mt-1 text-xs font-semibold text-[#ff1010]">
                          Obs: {item.note}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="rounded-full border border-[#ffd7d7] px-3 py-1 text-[11px] font-black text-[#d91c1c]"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecrement(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfda] bg-white text-lg font-black text-[#171717]"
                      >
                        -
                      </button>

                      <div className="min-w-8 text-center text-sm font-black">
                        {item.quantity}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleIncrement(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff1010] text-lg font-black text-white"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm font-black text-[#ff1010]">
                      {formatMoneyFromCents(
                        Number(item.price_cents || 0) * Number(item.quantity || 0)
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t border-[#eee] pt-3 text-right text-sm">
                <div className="mb-1 text-[#666]">
                  Subtotal: {formatMoneyFromCents(subtotalCents)}
                </div>
                <div className="mb-1 text-[#666]">
                  Entrega: {formatMoneyFromCents(deliveryFeeCents)}
                </div>
                <span className="text-lg font-black text-[#171717]">
                  Total: {formatMoneyFromCents(finalTotalCents)}
                </span>
              </div>
            </div>
          )}
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-[#eadfda] bg-white p-4 shadow-sm"
        >
          <h2 className="text-lg font-black">Dados de entrega</h2>

          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nome"
            className="w-full rounded-2xl border border-[#e7ddd8] px-4 py-3 text-sm outline-none"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone/WhatsApp"
            className="w-full rounded-2xl border border-[#e7ddd8] px-4 py-3 text-sm outline-none"
          />

          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Endereço completo"
            className="min-h-28 w-full rounded-2xl border border-[#e7ddd8] px-4 py-3 text-sm outline-none"
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações"
            className="min-h-24 w-full rounded-2xl border border-[#e7ddd8] px-4 py-3 text-sm outline-none"
          />

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-2xl border border-[#e7ddd8] px-4 py-3 text-sm outline-none"
          >
            <option value="pix">PIX</option>
            <option value="credito">Cartão de crédito</option>
            <option value="debito">Cartão de débito</option>
            <option value="dinheiro">Dinheiro</option>
          </select>

          {message ? (
            <p className="rounded-2xl bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#d91c1c]">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isDisabled}
            className="w-full rounded-full bg-[#ff1010] px-5 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            {loading ? "Enviando..." : `Finalizar ${formatMoneyFromCents(finalTotalCents)}`}
          </button>
        </form>
      </div>
    </main>
  );
}
