"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addToCart, getCartCount } from "@/lib/cart-storage";
import { products } from "@/data/home-data";
import { formatMoney } from "@/lib/utils/formatters";
import { ShoppingCart } from "lucide-react";

const sizes = [
  { label: "P", multiplier: 1 },
  { label: "M", multiplier: 1.2 },
  { label: "G", multiplier: 1.4 },
];

const crusts = [
  { label: "Sem borda", extra: 0 },
  { label: "Catupiry", extra: 8 },
  { label: "Cheddar", extra: 8 },
  { label: "Chocolate", extra: 10 },
];

const addonsList = [
  { label: "Extra queijo", extra: 6 },
  { label: "Bacon", extra: 7 },
  { label: "Cebola roxa", extra: 3 },
  { label: "Azeitona", extra: 4 },
];

export default function MobileProductPage() {
  const params = useParams();
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("M");
  const [crust, setCrust] = useState("Sem borda");
  const [note, setNote] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [message, setMessage] = useState("");

  const productId = Number(params.id);

  const product = useMemo(() => {
    return products.find((item) => item.id === productId);
  }, [productId]);

  useEffect(() => {
    setCartCount(getCartCount());
  }, []);

  if (!product) {
    notFound();
  }

  function getBasePrice() {
    if (!product) return 0;

    return Number(product.price || 0);
  }

  function getSizeMultiplier() {
    return sizes.find((s) => s.label === size)?.multiplier || 1;
  }

  function getCrustExtra() {
    return crusts.find((c) => c.label === crust)?.extra || 0;
  }

  function getAddonsExtra() {
    return selectedAddons.reduce((sum, addonLabel) => {
      const addon = addonsList.find((a) => a.label === addonLabel);
      return sum + (addon?.extra || 0);
    }, 0);
  }

  function getUnitPrice() {
    return getBasePrice() * getSizeMultiplier() + getCrustExtra() + getAddonsExtra();
  }

  function toggleAddon(label: string) {
    setSelectedAddons((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  }

  function handleAddToCart() {
    const unitPrice = getUnitPrice();
    const sizeId = size === "P" ? 1 : size === "M" ? 2 : 3;
    const crustId = crusts.findIndex((c) => c.label === crust);
    const addonsId = selectedAddons.length;

    if (!product) return;

    for (let i = 0; i < quantity; i += 1) {
      addToCart({
        id: Date.now() + Math.random(),
        name: `${product.name} (${size})${crust !== "Sem borda" ? ` - Borda ${crust}` : ""}`,
        price_cents: Math.round(unitPrice * 100),
        image: product.image,
        note: note,
        addons: selectedAddons,
      });
    }

    setCartCount(getCartCount());
    setMessage("Produto adicionado ao carrinho!");
  }

  return (
    <main className="min-h-screen pb-28 bg-[#f7f1ef] pb-28 text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            Voltar
          </button>

          <Link
            href="/m/checkout"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            🛒
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff1010] px-1 text-[10px] font-black text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-[#eadfda] bg-white shadow-sm">
          <div className="bg-[#efefef] p-4">
            <img
              src={product.image}
              alt={product.name}
              className="h-64 w-full rounded-[22px] object-cover"
            />
          </div>

          <div className="p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#ff1010]">
              {product.badge}
            </div>

            <h1 className="text-2xl font-black leading-tight text-[#171717]">
              {product.name}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-[#666]">
              {product.description}
            </p>

            <div className="mt-5 rounded-2xl bg-[#fff5f3] px-4 py-3">
              <div className="text-xs font-semibold text-[#777]">Preço unitário</div>
              <div className="text-2xl font-black text-[#ff1010]">
                R$ {getUnitPrice().toFixed(2).replace(".", ",")}
              </div>
            </div>

            <div className="mt-5">
              <h2 className="mb-2 text-sm font-black">Tamanho</h2>

              <div className="flex gap-2">
                {sizes.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSize(s.label)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-black",
                      size === s.label
                        ? "border-[#ff1010] bg-[#ff1010] text-white"
                        : "bg-white text-[#171717]",
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h2 className="mb-2 text-sm font-black">Borda recheada</h2>

              <div className="grid grid-cols-2 gap-2">
                {crusts.map((c) => {
                  const active = crust === c.label;

                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setCrust(c.label)}
                      className={[
                        "rounded-2xl border px-4 py-3 text-left",
                        active
                          ? "border-[#ff1010] bg-[#fff4f2]"
                          : "border-[#eadfda] bg-white",
                      ].join(" ")}
                    >
                      <div className="text-sm font-black text-[#171717]">
                        {c.label}
                      </div>
                      <div className="text-xs text-[#666]">
                        {c.extra > 0 ? `+ R$ ${c.extra.toFixed(2).replace(".", ",")}` : "Inclusa"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <h2 className="mb-2 text-sm font-black">Adicionais</h2>

              <div className="grid grid-cols-2 gap-2">
                {addonsList.map((addon) => {
                  const active = selectedAddons.includes(addon.label);

                  return (
                    <button
                      key={addon.label}
                      type="button"
                      onClick={() => toggleAddon(addon.label)}
                      className={[
                        "rounded-2xl border px-4 py-3 text-left",
                        active
                          ? "border-[#ff1010] bg-[#fff4f2]"
                          : "border-[#eadfda] bg-white",
                      ].join(" ")}
                    >
                      <div className="text-sm font-black text-[#171717]">
                        {addon.label}
                      </div>
                      <div className="text-xs text-[#666]">
                        + R$ {addon.extra.toFixed(2).replace(".", ",")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <h2 className="mb-2 text-sm font-black">Observações</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: sem cebola, assar mais..."
                className="w-full rounded-2xl border border-[#eadfda] p-3 text-sm"
              />
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#eadfda] bg-[#fffaf8] px-4 py-3">
              <div>
                <div className="text-xs font-semibold text-[#777]">Quantidade</div>
                <div className="text-sm font-black text-[#171717]">
                  Escolha quantas deseja
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eadfda] bg-white text-lg font-black text-[#171717]"
                >
                  -
                </button>

                <div className="min-w-8 text-center text-base font-black">
                  {quantity}
                </div>

                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff1010] text-lg font-black text-white"
                >
                  +
                </button>
              </div>
            </div>

            {message ? (
              <div className="mt-4 rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#c61c1c]">
                {message}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md px-3 pb-3 pt-2 backdrop-blur-md">
  <div className="rounded-2xl border border-[#efe3df] bg-white/80 px-3 py-3 shadow-[0_6px_20px_rgba(0,0,0,0.06)]">

        <button
          type="button"
          onClick={handleAddToCart}
          className="flex h-14 w-full items-center justify-between rounded-full bg-[#e30613] px-5 text-white shadow-[0_10px_20px_rgba(227,6,19,0.25)] transition active:scale-[0.98]"
        >
          <span className="flex items-center gap-3 text-sm font-bold">
            <span className="text-lg">🛒</span>
            Confirmar item
          </span>

          <span className="text-base font-black">
            R$ {(getUnitPrice() * quantity).toFixed(2).replace(".", ",")}
          </span>
        </button>
  </div>

</div>
    </main>
  );
}
