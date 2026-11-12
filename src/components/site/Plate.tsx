"use client";

import { useState } from "react";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/catalog/use-store-catalog";

// Foto do produto em formato de prato redondo. Sem foto, foto quebrada ou imagem
// "vazia" (um quadro de uma cor so, como as imagens cinza de teste): mostra um prato
// cor de massa com a inicial do produto.

/** Confere se a imagem carregada e praticamente de uma cor so. */
function isBlankImage(img: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    const size = 24;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    return max - min < 12;
  } catch {
    // Imagem de outro dominio sem permissao de leitura: assume que e foto de verdade.
    return false;
  }
}

export default function Plate({
  src,
  name,
  size,
  ring = 4,
  shadow,
  className = "",
}: {
  src: string | null;
  name: string;
  size: number;
  ring?: number;
  /** Sombra extra (CSS box-shadow), somada ao aro branco. */
  shadow?: string;
  className?: string;
}) {
  const [blank, setBlank] = useState(false);
  const usable = src && !blank && src !== PRODUCT_PLACEHOLDER_IMAGE;

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-[#F3E3C3] ${className}`}
      style={{ width: size, height: size, boxShadow: `0 0 0 ${ring}px #FFFFFF${shadow ? `, ${shadow}` : ""}` }}
    >
      {usable ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBlank(true)}
          onLoad={(e) => {
            if (isBlankImage(e.currentTarget)) setBlank(true);
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-full w-full place-items-center text-[#B07D2B]"
          style={{ fontSize: size * 0.4, fontWeight: 800 }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
