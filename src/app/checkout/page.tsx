"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { CartItem } from "@/types/order";
import {
  CART_CHANGED_EVENT,
  cartLineKey,
  clearCartByStore,
  getCartItemsByStore,
} from "@/lib/cart-storage";
import { getMobileStoreContext, hasSelectedStore } from "@/lib/mobile-store-context";
import { useStoreCatalog } from "@/lib/catalog/use-store-catalog";
import { computeDeliveryFeeCents, DEFAULT_STORE_SETTINGS } from "@/lib/store/settings-shared";
import { setActiveOrderId } from "@/lib/active-order";
import { saveLocalOrderCode } from "@/lib/local-orders";
import { focusRing, money } from "@/components/site/OptionPickers";
import { displayFont } from "@/lib/fonts";

// Finalizar pedido no SITE (o app usa /m/checkout). Mesma API e mesmas regras.
export default function SiteCheckoutPage() {
  const router = useRouter();
  const { catalog } = useStoreCatalog();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", payment: "" });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!hasSelectedStore()) {
      router.replace("/");
      return;
    }
    const storeId = getMobileStoreContext().storeId;
    const reload = () => setItems(getCartItemsByStore(storeId));
    reload();
    setReady(true);
    window.addEventListener(CART_CHANGED_EVENT, reload);
    return () => window.removeEventListener(CART_CHANGED_EVENT, reload);
  }, [router]);

  const paymentMethods = catalog?.paymentMethods || [];
  const payment = paymentMethods.some((m) => m.key === form.payment) ? form.payment : paymentMethods[0]?.key || "";

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.price_cents || 0) * i.quantity, 0),
    [items]
  );
  const fee = catalog ? computeDeliveryFeeCents({ ...DEFAULT_STORE_SETTINGS, ...catalog.settings }, subtotal) : 0;
  const minimum = catalog?.settings.minimumOrderCents || 0;
  const missing = minimum > 0 && subtotal < minimum ? minimum - subtotal : 0;
  const closed = catalog ? !catalog.status.open : false;

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setMessage("Informe seu nome.");
    if (form.phone.replace(/\D/g, "").length < 10) return setMessage("Informe um telefone com DDD.");
    if (!form.address.trim()) return setMessage("Informe o endereço de entrega.");
    if (closed) return setMessage(catalog?.status.message || "A loja está fechada.");
    if (missing > 0) return setMessage(`Faltam ${money(missing)} para o pedido mínimo.`);

    const store = getMobileStoreContext();
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-store-id": store.storeId },
        body: JSON.stringify({
          customerName: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          notes: form.notes.trim(),
          items: items.map((item) => ({ ...item, tenantId: store.tenantId, storeId: store.storeId })),
          tenantId: store.tenantId,
          storeId: store.storeId,
          subtotal_cents: subtotal,
          freight_cents: fee,
          total_cents: subtotal + fee,
          paymentMethod: payment,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível enviar o pedido.");

      const code = String(data?.order?.orderCode || data?.order?.id || "");
      clearCartByStore(store.storeId);
      if (code) {
        saveLocalOrderCode(code);
        setActiveOrderId(code);
        router.push(`/acompanhar/${encodeURIComponent(code)}`);
      } else {
        router.push("/");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setSending(false);
    }
  }

  const input =
    "w-full rounded-2xl border border-[#ECE6DF] bg-white px-4 py-3 text-[15px] outline-none focus:border-[#C8171E]";

  return (
    <main className="min-h-screen bg-[#FCFBF9] text-[#1F1A17]">
      <header className="border-b border-[#ECE6DF]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className={`${focusRing} inline-flex items-center gap-2 rounded text-sm font-semibold text-[#4A423C] hover:text-[#C8171E]`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar ao cardápio
          </Link>
          <span className={`${displayFont.className} text-xl font-extrabold text-[#C8171E]`}>
            {catalog?.store.brandName || ""}
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 lg:grid-cols-[1fr_360px]">
        <section>
          <h1 className={`${displayFont.className} text-4xl font-extrabold tracking-[-0.03em]`}>Finalizar pedido</h1>
          {catalog ? (
            <p className="mt-2 text-[#6B625B]">
              Entrega pela {catalog.store.name}. Pagamento na entrega.
            </p>
          ) : null}

          {ready && items.length === 0 ? (
            <div className="mt-8 rounded-[28px] border border-[#ECE6DF] bg-white p-8 text-center">
              <p className="text-[#6B625B]">Seu carrinho está vazio.</p>
              <Link href="/" className={`${focusRing} mt-4 inline-block rounded-full bg-[#C8171E] px-6 py-3 text-sm font-bold text-white`}>
                Ver o cardápio
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Nome</span>
                  <input value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" className={input} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Telefone / WhatsApp</span>
                  <input value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="(11) 99999-9999" className={input} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Endereço de entrega</span>
                <textarea value={form.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" rows={3} placeholder="Rua, número, complemento, bairro" className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Observações para a loja <span className="font-normal text-[#857A71]">(opcional)</span></span>
                <input value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Ex.: interfone quebrado, troco para R$ 100" className={input} />
              </label>

              {paymentMethods.length > 0 ? (
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Forma de pagamento</legend>
                  <div className="flex flex-wrap gap-2">
                    {paymentMethods.map((m) => (
                      <label
                        key={m.key}
                        className={[
                          "cursor-pointer rounded-full border px-4 py-2.5 text-sm font-medium focus-within:outline focus-within:outline-2 focus-within:outline-[#C8171E]",
                          payment === m.key ? "border-[#C8171E] bg-[#FDF2F1] text-[#A3141A]" : "border-[#ECE6DF] bg-white",
                        ].join(" ")}
                      >
                        <input type="radio" name="pagamento" className="sr-only" checked={payment === m.key} onChange={() => update("payment", m.key)} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {closed ? (
                <p className="rounded-2xl bg-[#FDEDEC] px-4 py-3 text-sm font-medium text-[#A3141A]">{catalog?.status.message}</p>
              ) : missing > 0 ? (
                <p className="rounded-2xl bg-[#FFF6E0] px-4 py-3 text-sm text-[#7A5600]">
                  Faltam {money(missing)} para o pedido mínimo de {money(minimum)}.
                </p>
              ) : null}
              {message ? <p className="rounded-2xl bg-[#FDEDEC] px-4 py-3 text-sm font-medium text-[#A3141A]">{message}</p> : null}

              <button
                type="submit"
                disabled={sending || !catalog || items.length === 0 || closed || missing > 0}
                className={`${focusRing} w-full rounded-full bg-[#C8171E] px-6 py-4 text-base font-bold text-white hover:bg-[#A9121A] disabled:bg-[#D9CFC4]`}
              >
                {sending ? "Enviando pedido..." : `Enviar pedido de ${money(subtotal + fee)}`}
              </button>
            </form>
          )}
        </section>

        <aside>
          <div className="rounded-[28px] border border-[#ECE6DF] bg-white p-5 lg:sticky lg:top-8">
            <h2 className={`${displayFont.className} text-xl font-bold`}>Resumo</h2>
            <ul className="mt-3 divide-y divide-[#F1ECE6]">
              {items.map((item) => (
                <li key={cartLineKey(item)} className="flex justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{item.quantity}× {item.name}</span>
                    {[item.size, item.crust].filter(Boolean).length > 0 ? (
                      <span className="block text-xs text-[#857A71]">{[item.size, item.crust].filter(Boolean).join(", ")}</span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap">{money(Number(item.price_cents || 0) * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-[#ECE6DF] pt-3 text-sm">
              <div className="flex justify-between text-[#6B625B]"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              <div className="flex justify-between text-[#6B625B]"><dt>Entrega</dt><dd>{fee > 0 ? money(fee) : "Grátis"}</dd></div>
              <div className="flex justify-between pt-1 text-base font-bold"><dt>Total</dt><dd>{money(subtotal + fee)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
