"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import type { CatalogProduct, Product } from "@/types/product";

type Props = {
  variant?: "site" | "mobile";
};

const categorias = [
  { id: "pizzas", nome: "Pizzas", icone: "🍕" },
  { id: "bebidas", nome: "Bebidas", icone: "🥤" },
  { id: "sobremesas", nome: "Sobremesas", icone: "🍰" },
  { id: "acomp", nome: "Acompanhamentos", icone: "🍟" },
];

function money(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function normalizeProduct(product: Product): CatalogProduct {
  return {
    id: String(product.id),
    name: product.name ?? product.nome ?? "Produto",
    description: product.description ?? product.desc ?? "",
    image: product.image,
    category: product.category ?? product.cat ?? "pizzas",
    price: Number(product.price ?? product.preco ?? 0),
    available: Boolean(product.available ?? product.ativo ?? true),
    tag: product.tag ?? null,
  };
}

function normalizeCartItem(item: Record<string, unknown>): CatalogProduct & { qty?: number } {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? item.nome ?? "Produto"),
    description: String(item.description ?? item.desc ?? ""),
    image: typeof item.image === "string" ? item.image : undefined,
    category: String(item.category ?? item.cat ?? "pizzas"),
    price: Number(item.price ?? item.preco ?? 0),
    available: Boolean(item.available ?? item.ativo ?? true),
    tag: typeof item.tag === "string" ? item.tag : null,
    qty: Number(item.qty ?? 0),
  };
}

export default function CatalogClient({ variant = "site" }: Props) {
  const {
    items,
    cartOpen,
    openCart,
    closeCart,
    addItem,
    removeItem,
    qtyOf,
    totalItems,
    subtotal,
    freight,
    total,
    mode,
    setMode,
    clearCart,
  } = useCart() as {
    items: Array<Record<string, unknown>>;
    cartOpen: boolean;
    openCart: () => void;
    closeCart: () => void;
    addItem: (product: unknown) => void;
    removeItem: (id: string | number) => void;
    qtyOf: (id: string | number) => number;
    totalItems: number;
    subtotal: number;
    freight: number;
    total: number;
    mode: "delivery" | "retirada";
    setMode: (mode: "delivery" | "retirada") => void;
    clearCart: () => void;
  };

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [catAtiva, setCatAtiva] = useState("pizzas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Falha ao carregar produtos.");
        }

        const data = (await response.json()) as { ok: boolean; items: Product[] };
        if (!active) return;

        const normalized = (data.items ?? []).map(normalizeProduct);
        setProducts(normalized);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const produtosFiltrados = useMemo(() => {
    return products.filter((product) => product.category === catAtiva && product.available);
  }, [products, catAtiva]);

  const cartItems = useMemo(() => items.map(normalizeCartItem), [items]);

  const agora = new Date();
  const minutosTotais = agora.getHours() * 60 + agora.getMinutes();
  const ABRE_MIN = 18 * 60;
  const FECHA_MIN = 23 * 60 + 30;
  const aberto = minutosTotais >= ABRE_MIN && minutosTotais < FECHA_MIN;

  function toCartPayload(product: CatalogProduct) {
    return {
      id: product.id,
      name: product.name,
      nome: product.name,
      description: product.description,
      desc: product.description,
      image: product.image,
      category: product.category,
      cat: product.category,
      price: product.price,
      preco: product.price,
      available: product.available,
      ativo: product.available,
      tag: product.tag ?? null,
    };
  }

  return (
    <main className="min-h-screen bg-[#0f0a06] text-white">
      <nav className="sticky top-0 z-50 border-b border-neutral-800/60 bg-[#0f0a06]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-8">
          <div className="flex shrink-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🍕</span>
              <span className="text-lg font-black tracking-tight text-orange-400">
                VenoZza
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${aberto ? "bg-emerald-400" : "bg-red-500"}`}
              />
              <span className={aberto ? "text-emerald-400" : "text-red-400"}>
                {aberto ? "Aberta agora" : "Fechada no momento"}
              </span>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
              Site
            </Link>
            <a href="#cardapio" className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white">
              Cardápio
            </a>
            <Link href="/m" className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white">
              App Mobile
            </Link>
          </div>

          <div className="flex-1" />

          <button
            onClick={openCart}
            className="relative flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 hover:bg-neutral-800"
          >
            <span>🛒</span>
            <span className="text-sm font-bold">{money(subtotal)}</span>
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-[10px] font-black text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        <div className="border-t border-neutral-800/60 bg-neutral-900/40">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-8">
            <div className="flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 p-1">
              <button
                onClick={() => setMode("delivery")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                  mode === "delivery" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Delivery
              </button>
              <button
                onClick={() => setMode("retirada")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                  mode === "retirada" ? "bg-orange-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Retirada
              </button>
            </div>

            <div className="hidden text-sm text-neutral-400 md:block">
              📍 Rua José Vila Busquets, 16 · Santo Amaro
            </div>

            <div className="flex-1" />

            <div className="text-right">
              <p className="text-xs font-bold text-neutral-300">{money(subtotal)}</p>
              <p className="text-[10px] text-neutral-500">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </p>
            </div>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 md:px-8 md:pt-16">
        <div className={`grid gap-10 ${variant === "site" ? "md:grid-cols-[1.2fr_.8fr]" : ""}`}>
          <div>
            <span className="inline-flex rounded-full border border-orange-900/50 bg-orange-950/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-orange-400">
              {variant === "mobile" ? "App mobile VenoZza" : "Site profissional VenoZza"}
            </span>

            <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-tight md:text-7xl">
              Pizza de verdade,
              <br />
              com operação
              <span className="text-orange-500"> profissional</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-300 md:text-lg">
              Catálogo integrado, carrinho global e base pronta para checkout, login,
              multi-loja e evolução da plataforma VenoZza.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#cardapio"
                className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-500"
              >
                Ver cardápio
              </a>
              <Link
                href={variant === "mobile" ? "/" : "/m"}
                className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-200 hover:bg-neutral-900"
              >
                {variant === "mobile" ? "Abrir site" : "Abrir app mobile"}
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-2xl">
            <p className="text-sm font-bold text-orange-400">Resumo do pedido</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-neutral-300">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-300">
                <span>Frete</span>
                <span>{money(freight)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-800 pt-3 text-base font-black text-white">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <button
              onClick={openCart}
              className="mt-6 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white hover:bg-orange-500"
            >
              Abrir carrinho
            </button>
          </div>
        </div>
      </section>

      <section id="cardapio" className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatAtiva(cat.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                catAtiva === cat.id
                  ? "bg-orange-600 text-white"
                  : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {cat.icone} {cat.nome}
            </button>
          ))}
        </div>

        {loading && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8 text-neutral-300">
            Carregando produtos...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-8 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && produtosFiltrados.length === 0 && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8 text-neutral-300">
            Nenhum produto encontrado nesta categoria.
          </div>
        )}

        {!loading && !error && produtosFiltrados.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {produtosFiltrados.map((product) => {
              const qty = qtyOf(product.id);

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/70"
                >
                  <div className="aspect-[16/10] bg-neutral-900">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">
                        {product.category === "bebidas" ? "🥤" : product.category === "sobremesas" ? "🍰" : "🍕"}
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">{product.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-neutral-400">
                          {product.description || "Produto disponível no catálogo VenoZza."}
                        </p>
                      </div>

                      {product.tag && (
                        <span className="rounded-full bg-orange-600/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-300">
                          {product.tag}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-lg font-black text-orange-400">
                        {money(product.price)}
                      </span>

                      {qty === 0 ? (
                        <button
                          onClick={() => addItem(toCartPayload(product))}
                          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500"
                        >
                          Adicionar
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-neutral-700 px-3 py-2">
                          <button
                            onClick={() => removeItem(product.id)}
                            className="text-lg font-black text-orange-400"
                          >
                            −
                          </button>
                          <span className="min-w-5 text-center text-sm font-bold">{qty}</span>
                          <button
                            onClick={() => addItem(toCartPayload(product))}
                            className="text-lg font-black text-orange-400"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {cartOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60">
          <div className="absolute right-0 top-0 h-full w-full max-w-md border-l border-neutral-800 bg-[#120c08] shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-orange-400">Seu carrinho</p>
                <p className="text-xs text-neutral-400">
                  {totalItems} {totalItems === 1 ? "item" : "itens"}
                </p>
              </div>
              <button
                onClick={closeCart}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                Fechar
              </button>
            </div>

            <div className="flex h-[calc(100%-76px)] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {cartItems.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-400">
                    Seu carrinho está vazio.
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={`${item.id}`}
                      className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-white">{item.name}</h4>
                          <p className="mt-1 text-xs text-neutral-400">
                            {money(item.price)} cada
                          </p>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-neutral-700 px-3 py-2">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-lg font-black text-orange-400"
                          >
                            −
                          </button>
                          <span className="min-w-5 text-center text-sm font-bold">
                            {item.qty ?? 0}
                          </span>
                          <button
                            onClick={() => addItem(toCartPayload(item))}
                            className="text-lg font-black text-orange-400"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-neutral-800 p-5">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Frete</span>
                    <span>{money(freight)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 text-base font-black text-white">
                    <span>Total</span>
                    <span>{money(total)}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-bold text-neutral-200 hover:bg-neutral-900"
                  >
                    Limpar
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white hover:bg-orange-500"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
