"use client";

import { useEffect, useState } from "react";
import { getMobileStoreHeaders } from "@/lib/mobile-store-context";

export type CatalogOption = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  description?: string | null;
};

export type OptionCatalog = {
  pizzaSizes: CatalogOption[];
  pizzaBorders: CatalogOption[];
  pizzaDoughs: CatalogOption[];
  pizzaDrinks: CatalogOption[];
  potatoSizes: CatalogOption[];
  potatoFillings: CatalogOption[];
};

const EMPTY_CATALOG: OptionCatalog = {
  pizzaSizes: [],
  pizzaBorders: [],
  pizzaDoughs: [],
  pizzaDrinks: [],
  potatoSizes: [],
  potatoFillings: [],
};

const EMPTY_OPTION: CatalogOption = { id: "", slug: "", name: "", price_cents: 0 };

/** Opcao padrao: a de preco zero (ex.: 35cm, sem borda, tradicional); senao a primeira. */
export function defaultOption(options: CatalogOption[]): CatalogOption {
  return options.find((o) => o.price_cents === 0) || options[0] || EMPTY_OPTION;
}

export function pickOption(options: CatalogOption[], id: string): CatalogOption {
  return options.find((o) => o.id === id) || defaultOption(options);
}

/** Tamanho familia (40cm): mesmo criterio do servidor para meio a meio. */
export function findFamilySize(sizes: CatalogOption[]): CatalogOption | null {
  const by40 = sizes.find((s) => /40/.test(s.name));
  if (by40) return by40;
  if (sizes.length === 0) return null;
  return sizes.reduce((a, b) => (b.price_cents > a.price_cents ? b : a));
}

export function useOptionCatalog() {
  const [catalog, setCatalog] = useState<OptionCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/options", {
          cache: "no-store",
          headers: getMobileStoreHeaders(),
        });
        const data = await res.json();

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "Erro ao carregar opcoes");
        }

        if (alive) {
          setCatalog({
            pizzaSizes: data.pizzaSizes || [],
            pizzaBorders: data.pizzaBorders || [],
            pizzaDoughs: data.pizzaDoughs || [],
            pizzaDrinks: data.pizzaDrinks || [],
            potatoSizes: data.potatoSizes || [],
            potatoFillings: data.potatoFillings || [],
          });
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "Erro ao carregar opcoes");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  return { catalog, loading, error };
}
