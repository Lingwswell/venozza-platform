"use client";

import { useEffect, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog/use-store-catalog";
import Plate from "@/components/site/Plate";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Tres lugares na abertura: o prato grande no centro e dois menores.
const SLOTS = [
  { size: 300, left: 130, top: 20, z: 3, label: "center" },
  { size: 156, left: 0, top: 200, z: 2, label: "left" },
  { size: 140, left: 380, top: 0, z: 1, label: "right" },
] as const;

const ROTATE_MS = 5000;

// Pratos em destaque da abertura do site: giram devagar e se revezam nos lugares.
// Os produtos sao os marcados como "Destaque" no admin (ate 5).
export default function FeaturedPlates({
  products,
  onSelect,
}: {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const total = products.length;

  useEffect(() => {
    if (total < 2 || paused || reduceMotion) return;
    const timer = setInterval(() => setOffset((o) => (o + 1) % total), ROTATE_MS);
    return () => clearInterval(timer);
  }, [total, paused, reduceMotion]);

  if (total === 0) return null;

  const visible = Math.min(SLOTS.length, total);
  // Em qual lugar cada produto esta agora (-1 = fora da tela, esperando a vez).
  const slotOf = (index: number) => {
    const pos = (index - offset + total) % total;
    return pos < visible ? pos : -1;
  };

  return (
    <div
      className="relative mx-auto hidden h-[380px] w-[520px] lg:block"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {products.map((product, index) => {
        const slotIndex = slotOf(index);
        const slot = SLOTS[slotIndex === -1 ? 0 : slotIndex];
        const hidden = slotIndex === -1;

        return (
          <button
            type="button"
            key={product.id}
            onClick={() => onSelect(product)}
            tabIndex={hidden ? -1 : 0}
            aria-hidden={hidden}
            aria-label={`${product.name}, ${money(product.price_cents)}`}
            className="group absolute rounded-full transition-all duration-700 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
            style={{
              left: slot.left,
              top: slot.top,
              zIndex: hidden ? 0 : slot.z,
              opacity: hidden ? 0 : 1,
              transform: hidden ? "scale(0.6)" : "scale(1)",
              pointerEvents: hidden ? "none" : "auto",
            }}
          >
            <Plate
              src={product.image}
              name={product.name}
              size={slot.size}
              ring={slot.size > 200 ? 6 : 4}
              shadow="0 18px 40px rgba(0,0,0,0.45)"
              spin
              className="transition-[width,height] duration-700 ease-out motion-reduce:transition-none"
            />
          </button>
        );
      })}

      {/* Etiquetas numa camada acima dos pratos, para nenhuma ficar escondida. */}
      {SLOTS.slice(0, visible).map((slot, slotIndex) => {
        const product = products[(slotIndex + offset) % total];
        const labelPos =
          slot.label === "center"
            ? { left: slot.left + slot.size / 2, transform: "translateX(-50%)" }
            : slot.label === "left"
              ? { left: slot.left }
              : { right: 520 - (slot.left + slot.size) };

        return (
          <span
            key={`${slotIndex}-${product.id}`}
            aria-hidden
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1C1917] shadow-sm motion-safe:animate-[fadeIn_.5s_ease-out]"
            style={{ top: slot.top + slot.size - 14, ...labelPos }}
          >
            {product.name} <span className="text-[#B91C1C]">{money(product.price_cents)}</span>
          </span>
        );
      })}

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
