"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ensureMobileStoreContext,
  getMobileStoreHeaders,
} from "@/lib/mobile-store-context";
import {
  Bell,
  ChevronDown,
  Clock3,
  Heart,
  Home,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Star,
  UserRound,
} from "lucide-react";

type ApiProduct = {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  price_cents?: number;
  price?: number;
  available?: boolean;
};

type ProductsResponse =
  | ApiProduct[]
  | {
      ok?: boolean;
      products?: ApiProduct[];
      data?: ApiProduct[];
      items?: ApiProduct[];
    };

function normalizeProducts(payload: ProductsResponse): ApiProduct[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.products)) {
    return payload.products;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

function formatMoney(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

function getPriceInCents(product: ApiProduct) {
  if (typeof product.price_cents === "number") {
    return product.price_cents;
  }

  if (typeof product.price === "number") {
    return Math.round(product.price * 100);
  }

  return 0;
}

const categoryFallback = [
  "Todos",
  "Pizzas",
  "Combos",
  "Bebidas",
  "Sobremesas",
];

export default function VenozzaHomeV2() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [storeName, setStoreName] = useState("VenoZza");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const store = ensureMobileStoreContext();
        setStoreName(store.storeName);

        const response = await fetch("/api/products", {
          method: "GET",
          headers: getMobileStoreHeaders(),
          cache: "no-store",
        });

        const payload = (await response.json()) as ProductsResponse;

        if (!response.ok) {
          throw new Error("Não foi possível carregar o cardápio.");
        }

        if (active) {
          setProducts(
            normalizeProducts(payload).filter(
              (product) => product.available !== false
            )
          );
        }
      } catch (error) {
        console.error("[mobile-v2] erro ao carregar produtos:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const apiCategories = products
      .map((product) => product.category?.trim())
      .filter((category): category is string => Boolean(category));

    const unique = Array.from(new Set(apiCategories));

    return unique.length > 0 ? ["Todos", ...unique] : categoryFallback;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "Todos" ||
        product.category === selectedCategory;

      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description?.toLowerCase().includes(normalizedSearch) ||
        product.category?.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#fffaf5] pb-24 text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#fffaf5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#8f1724] text-white shadow-sm">
              <MapPin size={21} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Entregar em
              </p>
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold">
                  {storeName}
                </span>
                <ChevronDown size={16} />
              </div>
            </div>
          </button>

          <button
            type="button"
            aria-label="Notificações"
            className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
          >
            <Bell size={21} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#d89a28] ring-2 ring-white" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">
        <section className="px-4 pt-5">
          <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#61101b] via-[#8f1724] to-[#be2638] p-6 text-white shadow-xl shadow-[#8f1724]/15">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur">
                VenoZza
              </span>

              <h1 className="mt-4 max-w-md text-3xl font-black leading-tight sm:text-4xl">
                Sabor de verdade, do forno até você.
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
                Pizzas artesanais, combos e ofertas preparados pela unidade
                mais próxima.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="#cardapio"
                  className="rounded-2xl bg-[#e3aa3f] px-5 py-3 text-sm font-black text-[#3c1600] shadow-lg shadow-black/10"
                >
                  Ver cardápio
                </a>

                <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur">
                  <Clock3 size={17} />
                  35–50 min
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pt-5">
          <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
            <Search className="shrink-0 text-zinc-400" size={21} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="O que você está com vontade de comer?"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400"
            />
          </label>
        </section>

        <section className="px-4 pt-6">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {categories.map((category) => {
              const selected = selectedCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={[
                    "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
                    selected
                      ? "bg-[#8f1724] text-white shadow-lg shadow-[#8f1724]/20"
                      : "bg-white text-zinc-700 ring-1 ring-black/5",
                  ].join(" ")}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </section>

        <section id="cardapio" className="px-4 pb-8 pt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#8f1724]">
                Escolha seu favorito
              </p>
              <h2 className="text-2xl font-black">Cardápio VenoZza</h2>
            </div>

            <span className="text-xs font-semibold text-zinc-500">
              {visibleProducts.length} itens
            </span>
          </div>

          {loading ? (
            <div className="rounded-[26px] bg-white px-6 py-12 text-center ring-1 ring-black/5">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#8f1724]" />
              <p className="mt-4 text-sm font-bold text-zinc-600">
                Carregando cardápio...
              </p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-[26px] bg-white px-6 py-12 text-center ring-1 ring-black/5">
              <Search className="mx-auto text-zinc-300" size={36} />
              <h3 className="mt-4 text-lg font-black">
                Nenhum produto encontrado
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                Tente outra busca ou selecione uma categoria diferente.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product) => {
                const priceInCents = getPriceInCents(product);

                return (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-black/5"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center bg-gradient-to-br from-[#f5d9c8] to-[#f4b6a8]">
                          <ShoppingBag
                            className="text-[#8f1724]/60"
                            size={42}
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        aria-label={`Favoritar ${product.name}`}
                        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur"
                      >
                        <Heart size={19} />
                      </button>

                      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                        <Star size={13} fill="currentColor" />
                        4,9
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8f1724]">
                        {product.category || "VenoZza"}
                      </p>

                      <h3 className="mt-2 text-lg font-black leading-tight">
                        {product.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500">
                        {product.description ||
                          "Produto preparado com ingredientes selecionados."}
                      </p>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-zinc-400">
                            A partir de
                          </p>
                          <p className="text-xl font-black text-[#8f1724]">
                            {formatMoney(priceInCents)}
                          </p>
                        </div>

                        <Link
                          href={`/m/produto/${product.id}`}
                          className="rounded-2xl bg-[#8f1724] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#8f1724]/15"
                        >
                          Escolher
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {[
            { label: "Início", icon: Home, active: true },
            { label: "Cardápio", icon: Menu },
            { label: "Pedidos", icon: ShoppingBag, href: "/m/pedidos" },
            { label: "Ofertas", icon: Star },
            { label: "Perfil", icon: UserRound, href: "/m/perfil" },
          ].map((item) => {
            const Icon = item.icon;

            const content = (
              <>
                <Icon size={21} />
                <span className="text-[11px] font-bold">{item.label}</span>
              </>
            );

            const className = [
              "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2",
              item.active ? "text-[#8f1724]" : "text-zinc-400",
            ].join(" ");

            return item.href ? (
              <Link key={item.label} href={item.href} className={className}>
                {content}
              </Link>
            ) : (
              <button key={item.label} type="button" className={className}>
                {content}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
