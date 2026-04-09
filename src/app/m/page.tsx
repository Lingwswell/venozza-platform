"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addToCart, getCartCount } from "@/lib/cart-storage";
import { categories, heroSlides, products } from "@/data/home-data";
import AppBottomNav from "@/components/navigation/AppBottomNav";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function MobileAppPage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  const pizzaItems = useMemo(
    () => products.filter((item) => item.section === "pizzas"),
    []
  );

  useEffect(() => {
    setCartCount(getCartCount());

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const slide = heroSlides[activeSlide];

  function handleAdd(product: (typeof products)[number]) {
    addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      image: product.image,
    });

    setCartCount(getCartCount());
  }

  return (
    <main className="min-h-screen pb-32 bg-[#f7f1ef] text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 pt-3 pb-40">
        <header className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff1010] text-white shadow-sm">
                🍕
              </div>
              <div>
                <div className="text-lg font-black leading-none text-[#ff1010]">VenoZza</div>
                <div className="text-[11px] font-semibold italic text-[#d61717]">
                  O saboooor da Pizza
                </div>
              </div>
            </div>

            <Link
              href="/m/checkout"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#eadfda] bg-white shadow-sm"
            >
              <span className="text-base leading-none">🛒</span>
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff1010] px-1 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        <div className="mb-5 rounded-full border border-[#ece3df] bg-white px-4 py-3 text-sm text-[#9b9b9b] shadow-sm">
          🔎 Buscar pizza, bebida ou sobremesa...
        </div>

        <section className="mb-6">
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#15171d] to-[#323846] p-5 text-white shadow-xl">
            <span className="rounded-full bg-[#ff1010] px-3 py-1 text-[10px] font-bold">
              {slide.tag}
            </span>

            <h1 className="mt-3 text-[22px] font-black leading-tight">
              {slide.title}
            </h1>

            <p className="mt-2 text-xs leading-relaxed text-white/80">
              {slide.description}
            </p>

            <button
              type="button"
              className="mt-4 rounded-full bg-[#ff1010] px-5 py-2.5 text-sm font-black text-white"
            >
              {slide.cta}
            </button>
          </div>
        </section>

        <section className="mb-6">
          <div className="grid grid-cols-4 gap-3">
            {categories.map((cat) => (
              <a key={cat.id} href={`#${cat.id}`} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ff1010] text-white shadow-sm">
                  {cat.icon}
                </div>
                <div className="mt-2 text-[11px] font-bold text-[#171717]">
                  {cat.shortName}
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="pizzas">
          <h2 className="mb-4 text-[18px] font-black">Pizzas</h2>

          <div className="grid grid-cols-2 gap-3">
            {pizzaItems.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-[22px] border border-[#eadfda] bg-white shadow-sm"
              >
                <Link href={`/m/produto/${product.id}`} className="block p-3 pb-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-24 w-full rounded-[16px] object-cover"
                  />

                  <h3 className="mt-3 text-sm font-black leading-tight text-[#171717]">
                    {product.name}
                  </h3>

                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6f6f6f]">
                    {product.description}
                  </p>
                </Link>

                <div className="flex items-center justify-between gap-2 p-3 pt-2">
                  <span className="text-[15px] font-black text-[#ff1010]">
                    {formatMoney(Number(product.price || 0))}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleAdd(product)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <AppBottomNav />
    </main>
  );
}