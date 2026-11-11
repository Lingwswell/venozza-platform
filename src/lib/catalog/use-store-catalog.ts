"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureMobileStoreContext, setMobileStoreContext } from "@/lib/mobile-store-context";
import type { OpenStatus, PaymentMethodKey } from "@/lib/store/settings-shared";

// Tipos da resposta de /api/catalog — a mesma fonte para app (/m), site (/) e checkout.

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  category: string;
  customizationType: string;
  price_cents: number;
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

export function formatDeliveryWindow(settings: CatalogStoreSettings) {
  const { deliveryTimeMinMinutes: min, deliveryTimeMaxMinutes: max } = settings;
  return max > min ? `${min}–${max} min` : `${min} min`;
}

/** Produtos em destaque; se nenhum foi marcado no admin, usa os primeiros com foto. */
export function pickFeatured(products: CatalogProduct[], limit = 4) {
  const marked = products.filter((p) => p.featured);
  if (marked.length > 0) return marked.slice(0, limit);
  const withImage = products.filter((p) => p.image);
  return (withImage.length > 0 ? withImage : products).slice(0, Math.min(limit, 3));
}

export function useStoreCatalog() {
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const context = ensureMobileStoreContext();
      const res = await fetch(`/api/catalog?storeId=${encodeURIComponent(context.storeId)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

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
  }, [load]);

  return { catalog, loading, error, reload: load };
}
