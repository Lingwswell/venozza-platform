"use client";

import { useState } from "react";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/catalog/use-store-catalog";

// Foto do produto em formato de prato redondo. Sem foto (ou foto quebrada):
// um "prato" cor de massa com a inicial do produto, em vez de um quadrado cinza.
export default function Plate({
  src,
  name,
  size,
  className = "",
}: {
  src: string | null;
  name: string;
  size: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const usable = src && !broken && src !== PRODUCT_PLACEHOLDER_IMAGE;

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-[#F3DDB3] ring-4 ring-white ${className}`}
      style={{ width: size, height: size }}
    >
      {usable ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-full w-full place-items-center text-[#B9863A]"
          style={{ fontSize: size * 0.38, fontWeight: 800 }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
