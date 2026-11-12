"use client";

import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import {
  STORE_CHANGED_EVENT,
  clearMobileStoreContext,
  getMobileStoreContext,
  setMobileStoreContext,
} from "@/lib/mobile-store-context";
import type { OpenStatus, PaymentMethodKey } from "@/lib/store/settings-shared";

// Tipos da resposta de /api/catalog — a mesma fonte para app (/m), site (/) e checkout.

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  category: string;
  customizationType: string;
  /** Preco ja com promocao (se houver). */
  price_cents: number;
  /** Preco sem promocao, quando ha promocao valendo (para mostrar riscado). */
  original_price_cents?: number | null;
  promo_title?: string | null;
  stock: number;
  featured: boolean;
};

export type CatalogCategory = {
  key: string;
  label: string;
  shortName: string;
  icon: string;
  sortOrder: number;
  count: number;
  showInMobile: boolean;
  showInSite: boolean;
};

export type CatalogStoreSettings = {
  deliveryTimeMinMinutes: number;
  deliveryTimeMaxMinutes: number;
  minimumOrderCents: number;
  deliveryFeeCents: number;
  freeDeliveryAboveCents: number | null;
  whatsapp: string | null;
};

export type StoreCatalog = {
  store: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    state: string | null;
    address: string | null;
    tenantId: string;
    brandName: string;
  };
  settings: CatalogStoreSettings;
  status: OpenStatus;
  paymentMethods: { key: PaymentMethodKey; label: string }[];
  categories: CatalogCategory[];
  products: CatalogProduct[];
};

export const PRODUCT_PLACEHOLDER_IMAGE = "/images/placeholder-product.svg";

export function productImage(product: { image?: string | null }) {
  return product.image || PRODUCT_PLACEHOLDER_IMAGE;
}

/** Se a foto do produto nao carregar (arquivo apagado, endereco errado), mostra a imagem padrao. */
export function handleProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (!img.src.endsWith(PRODUCT_PLACEHOLDER_IMAGE)) {
    img.src = PRODUCT_PLACEHOLDER_IMAGE;
  }
}

export function formatDeliveryWindow(settings: CatalogStoreSettings) {
  const { deliveryTimeMinMinutes: min, deliveryTimeMaxMinutes: max } = settings;
  return max > min ? `${min}–${max} min` : `${min} min`;
}

/** Produtos em destaque; se nenhum foi marcado no admin, usa os primeiros com foto. */
export function pickFeatured(products: CatalogProduct[], limit = 4) {
  const marked = products.filter((p) => p.featured);
  if (marked.length > 0) return marked.slice(0, limit);
  // Sem destaque marcado no admin: pizzas primeiro (com foto antes), depois o resto.
  const score = (p: CatalogProduct) => (p.category === "pizza" ? 0 : 2) + (p.image ? 0 : 1);
  return [...products].sort((a, b) => score(a) - score(b)).slice(0, Math.min(limit, 3));
}

export function useStoreCatalog() {
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // true quando o cliente ainda nao escolheu loja (ou a salva nao vale mais)
  const [needsStore, setNeedsStore] = useState(false);

  const load = useCallback(async () => {
    const context = getMobileStoreContext();

    if (!context.storeId) {
      setCatalog(null);
      setNeedsStore(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNeedsStore(false);

    try {
      const res = await fetch(`/api/catalog?storeId=${encodeURIComponent(context.storeId)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      // Loja salva nao existe mais ou e de outra rede: pede para escolher de novo.
      if (data?.code === "STORE_NOT_FOUND" || data?.code === "STORE_REQUIRED") {
        clearMobileStoreContext();
        setCatalog(null);
        setNeedsStore(true);
        return;
      }

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Erro ao carregar o cardápio (HTTP ${res.status}).`);
      }

      const next = data as StoreCatalog;

      // Mantem nome da loja/tenant salvos em dia para o carrinho e o checkout.
      setMobileStoreContext({
        tenantId: next.store.tenantId,
        storeName: next.store.name,
        storeSlug: next.store.slug,
      });

      setCatalog(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o cardápio.");
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(STORE_CHANGED_EVENT, load);
    return () => window.removeEventListener(STORE_CHANGED_EVENT, load);
  }, [load]);

  return { catalog, loading, error, needsStore, reload: load };
}
