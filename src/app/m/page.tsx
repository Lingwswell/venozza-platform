"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PromoBalloons from "@/components/promo/PromoBalloons";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock3, MapPin, Search, ShoppingBag, Star } from "lucide-react";
import { addToCart, getCartCountByStore, purgeLegacyCartItems } from "@/lib/cart-storage";
import AppBottomNav from "@/components/navigation/AppBottomNav";
import StorePicker from "@/components/store/StorePicker";
import { ensureMobileStoreContext } from "@/lib/mobile-store-context";
import { normalizeText } from "@/lib/catalog/category";
import {
  formatDeliveryWindow,
  pickFeatured,
  handleProductImageError,
  productImage,
  useStoreCatalog,
  type CatalogProduct,
} from "@/lib/catalog/use-store-catalog";

type DisplayProduct = CatalogProduct & {
  beverageGroup?: boolean;
  variantCount?: number;
};

function formatMoneyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getBeverageGroupName(name: string) {
  const normalized = normalizeText(name);

  const knownBrands = [
    { match: "coca-cola zero", label: "Coca-Cola Zero" },
    { match: "coca cola zero", label: "Coca-Cola Zero" },
    { match: "coca-cola", label: "Coca-Cola" },
    { match: "coca cola", label: "Coca-Cola" },
    { match: "guarana antarctica", label: "Guaraná Antarctica" },
    { match: "guarana", label: "Guaraná" },
    { match: "fanta", label: "Fanta" },
    { match: "sprite", label: "Sprite" },
    { match: "pepsi", label: "Pepsi" },
    { match: "agua", label: "Água" },
    { match: "suco", label: "Suco" },
  ];

  const brand = knownBrands.find((item) => normalized.includes(item.match));
  if (brand) return brand.label;

  return (
    name
      .replace(/\b(lata|mini|garrafa|pet|retornavel|retornável|caixa)\b/gi, "")
      .replace(/\b\d+(?:[,.]\d+)?\s*(ml|l|litros|litro)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || name
  );
}

// Bebidas da mesma marca em tamanhos diferentes viram um card so ("a partir de").
function groupBeverages(products: CatalogProduct[]): DisplayProduct[] {
  const result: DisplayProduct[] = [];
  const groups = new Map<string, CatalogProduct[]>();

  for (const product of products) {
    if (product.category !== "bebida") {
      result.push(product);
      continue;
    }
    const name = getBeverageGroupName(product.name);
    groups.set(name, [...(groups.get(name) || []), product]);
  }

  for (const [name, variants] of groups.entries()) {
    const sorted = [...variants].sort((a, b) => a.price_cents - b.price_cents);
    const cheapest = sorted[0];
    if (!cheapest) continue;

    if (sorted.length === 1) {
      result.push(cheapest);
      continue;
    }

    result.push({
      ...cheapest,
      name,
      description: `${sorted.length} opções de tamanho disponíveis.`,
      image: sorted.find((v) => v.image)?.image ?? null,
      beverageGroup: true,
      variantCount: sorted.length,
    });
  }

  return result;
}

export default function MobileAppPage() {
  const { catalog, loading, error, needsStore } = useStoreCatalog();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [activeCategoryKey, setActiveCategoryKey] = useState("");
  const [search, setSearch] = useState("");

  const featured = useMemo(() => pickFeatured(catalog?.products || []), [catalog]);

  const categories = useMemo(
    () => (catalog?.categories || []).filter((c) => c.showInMobile),
    [catalog]
  );

  const visibleProducts = useMemo(() => {
    const keys = new Set(categories.map((c) => c.key));
    return groupBeverages((catalog?.products || []).filter((p) => keys.has(p.category)));
  }, [catalog, categories]);

  const searchResults = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return null;
    return visibleProducts.filter((p) =>
      normalizeText(`${p.name} ${p.description || ""}`).includes(term)
    );
  }, [search, visibleProducts]);

  const activeCategory =
    categories.find((c) => c.key === activeCategoryKey) || categories[0] || null;

  const activeProducts = activeCategory
    ? visibleProducts.filter((p) => p.category === activeCategory.key)
    : [];

  useEffect(() => {
    purgeLegacyCartItems();
  }, []);

  // Carrinho e por loja: atualiza o contador quando a loja muda.
  useEffect(() => {
    if (catalog) setCartCount(getCartCountByStore(catalog.store.id));
  }, [catalog]);

  useEffect(() => {
    if (featured.length < 2) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % featured.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [featured.length]);

  const slide = featured[activeSlide % Math.max(featured.length, 1)];

  function handleAdd(product: DisplayProduct) {
    const store = ensureMobileStoreContext();

    addToCart({
      id: product.id,
      name: product.name,
      quantity: 1,
      price_cents: product.price_cents,
      image: productImage(product),
      tenantId: store.tenantId,
      storeId: store.storeId,
    });

    setCartCount(getCartCountByStore(store.storeId));
  }

  function renderProductCard(product: DisplayProduct) {
    // Bebida agrupada e produto montavel (pizza etc.) abrem a pagina do produto para escolher.
    const needsChoice =
      product.beverageGroup === true ||
      product.category === "pizza" ||
      product.customizationType !== "auto";

    return (
      <article
        key={product.id}
        className="overflow-hidden rounded-[22px] border border-[#eadfda] bg-white shadow-sm"
      >
        <Link href={`/m/produto/${product.id}`} className="block p-3 pb-0">
          <img
            src={productImage(product)}
            onError={handleProductImageError}
            alt={product.name}
            className="h-24 w-full rounded-[16px] bg-[#fff4ef] object-cover"
          />
          <h3 className="mt-3 text-sm font-black leading-tight text-[#171717]">{product.name}</h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6f6f6f]">
              {product.description}
            </p>
          ) : null}
        </Link>

        <div className="flex items-center justify-between gap-2 p-3 pt-2">
          <span className="text-[15px] font-black text-[#ff1010]">
            {product.original_price_cents && !product.beverageGroup ? (
              <s className="mr-1 block text-[10px] font-bold text-[#8a817d]">{formatMoneyFromCents(product.original_price_cents)}</s>
            ) : null}
            {product.beverageGroup ? <span className="text-[10px] font-bold text-[#8a817d]">a partir de </span> : null}
            {formatMoneyFromCents(product.price_cents)}
          </span>

          {needsChoice ? (
            <Link
              href={`/m/produto/${product.id}`}
              aria-label={`Escolher ${product.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
            >
              +
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => handleAdd(product)}
              aria-label={`Adicionar ${product.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
            >
              +
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f1ef] pb-32 text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 pb-40 pt-3">
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label="Trocar de loja"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-gradient-to-br from-[#ff2a1f] to-[#c90816] text-xl font-black text-white shadow-[0_10px_25px_rgba(214,23,23,0.28)]">
                {(catalog?.store.brandName || "·").charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[17px] font-black text-[#171717]">
                    {catalog?.store.brandName || " "}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#d61717]" />
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#767676]">
                  <MapPin className="h-3.5 w-3.5 text-[#d61717]" />
                  <span className="truncate">{catalog?.store.name || "Escolha a loja"}</span>
                </div>
              </div>
            </button>

            <Link
              href="/m/carrinho"
              aria-label="Abrir carrinho"
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[#171717] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition active:scale-95"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff201c] px-1 text-[10px] font-black text-white ring-2 ring-[#f7f1ef]">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        {catalog && !catalog.status.open ? (
          <div className="mb-4 rounded-[20px] border border-[#ffd2cc] bg-[#fff1ef] px-4 py-3 text-sm font-bold text-[#b3261e]">
            {catalog.status.message}
          </div>
        ) : null}

        <section className="mb-4">
          <label className="flex items-center gap-3 rounded-[20px] border border-[#eee3de] bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(50,30,20,0.05)] transition focus-within:border-[#ff2a1f]/40 focus-within:ring-4 focus-within:ring-[#ff2a1f]/5">
            <Search className="h-5 w-5 shrink-0 text-[#d61717]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#222] outline-none placeholder:text-[#9a918d]"
            />
          </label>
        </section>

        {catalog ? (
          <section className="mb-5 flex flex-wrap gap-2 text-[11px] font-bold text-[#5f5652]">
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <Clock3 className="h-3.5 w-3.5 text-[#d61717]" />
              {formatDeliveryWindow(catalog.settings)}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
              Entrega {catalog.settings.deliveryFeeCents > 0 ? formatMoneyFromCents(catalog.settings.deliveryFeeCents) : "grátis"}
            </span>
            {catalog.settings.freeDeliveryAboveCents ? (
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                Grátis acima de {formatMoneyFromCents(catalog.settings.freeDeliveryAboveCents)}
              </span>
            ) : null}
            {catalog.settings.minimumOrderCents > 0 ? (
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                Mínimo {formatMoneyFromCents(catalog.settings.minimumOrderCents)}
              </span>
            ) : null}
          </section>
        ) : null}

        {slide && !searchResults ? (
          <section className="mb-6">
            <div className="relative isolate overflow-hidden rounded-[28px] bg-[#171717] px-5 py-6 text-white shadow-[0_18px_45px_rgba(21,12,10,0.22)]">
              <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#ff271d]/35 blur-2xl" />

              <div className="relative z-10 max-w-[58%]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                  <Star className="h-3.5 w-3.5 fill-[#ffc354] text-[#ffc354]" />
                  Destaque
                </span>
                <h1 className="mt-4 text-[23px] font-black leading-[1.08] tracking-[-0.03em]">
                  {slide.name}
                </h1>
                {slide.description ? (
                  <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-white/72">
                    {slide.description}
                  </p>
                ) : null}
                <Link
                  href={`/m/produto/${slide.id}`}
                  className="mt-4 inline-block rounded-[14px] bg-gradient-to-r from-[#ff2c20] to-[#dc0718] px-5 py-3 text-xs font-black text-white shadow-[0_10px_22px_rgba(255,37,30,0.28)] transition active:scale-95"
                >
                  {formatMoneyFromCents(slide.price_cents)} · Pedir
                </Link>
              </div>

              <img
                src={productImage(slide)}
                onError={handleProductImageError}
                alt=""
                className="absolute bottom-4 right-4 top-4 w-[38%] rounded-[22px] object-cover"
              />
            </div>

            {featured.length > 1 ? (
              <div className="mt-3 flex justify-center gap-1.5">
                {featured.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Ver destaque ${index + 1}`}
                    className={[
                      "h-1.5 rounded-full transition-all",
                      index === activeSlide % featured.length ? "w-7 bg-[#d61717]" : "w-1.5 bg-[#d9ceca]",
                    ].join(" ")}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {needsStore ? null : loading ? (
          <div className="rounded-[22px] border border-[#eadfda] bg-white p-4 text-sm font-bold text-[#666] shadow-sm">
            Carregando cardápio...
          </div>
        ) : error ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
            {error}
          </div>
        ) : searchResults ? (
          <section>
            <h2 className="mb-4 text-[18px] font-black">
              {searchResults.length} resultado{searchResults.length === 1 ? "" : "s"}
            </h2>
            {searchResults.length === 0 ? (
              <p className="text-sm text-[#6f6f6f]">Nada encontrado para “{search}”.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">{searchResults.map(renderProductCard)}</div>
            )}
          </section>
        ) : categories.length === 0 ? (
          <div className="rounded-[22px] border border-[#eadfda] bg-white p-4 text-sm font-bold text-[#666] shadow-sm">
            Nenhum produto disponível nesta loja no momento.
          </div>
        ) : (
          <>
            <section className="mb-7">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d61717]">Cardápio</p>
                  <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[#171717]">
                    Escolha uma categoria
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-[#89817e]">{visibleProducts.length} produtos</span>
              </div>

              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((cat) => {
                  const selected = activeCategory?.key === cat.key;
                  const count = visibleProducts.filter((p) => p.category === cat.key).length;

                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setActiveCategoryKey(cat.key)}
                      className={[
                        "flex min-w-[92px] shrink-0 flex-col items-center rounded-[22px] border px-3 py-4 text-center shadow-sm transition active:scale-95",
                        selected
                          ? "border-[#d61717] bg-[#d61717] text-white shadow-[0_12px_26px_rgba(214,23,23,0.22)]"
                          : "border-[#eee3de] bg-white text-[#262626]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-12 w-12 place-items-center rounded-[17px] text-2xl",
                          selected ? "bg-white/15" : "bg-[#fff2ed]",
                        ].join(" ")}
                      >
                        {cat.icon}
                      </span>
                      <span className="mt-2.5 text-[11px] font-black">{cat.shortName}</span>
                      <span className={["mt-1 text-[9px] font-bold", selected ? "text-white/70" : "text-[#9b918d]"].join(" ")}>
                        {count} {count === 1 ? "item" : "itens"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {activeCategory ? (
              <section key={activeCategory.key}>
                <h2 className="mb-4 text-[18px] font-black">{activeCategory.label}</h2>

                <div className="grid grid-cols-2 gap-3">
                  {activeCategory.key === "pizza" ? (
                    <article className="overflow-hidden rounded-[22px] border border-[#eadfda] bg-white shadow-sm">
                      <Link href="/m/meio-a-meio" className="block p-3 pb-0">
                        <div className="flex h-24 w-full items-center justify-center rounded-[16px] bg-[#fff1f1] text-4xl">
                          🍕
                        </div>
                        <h3 className="mt-3 text-sm font-black leading-tight text-[#171717]">Pizza meio a meio</h3>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6f6f6f]">
                          Monte uma pizza com 2 sabores.
                        </p>
                      </Link>
                      <div className="flex items-center justify-between gap-2 p-3 pt-2">
                        <span className="text-[15px] font-black text-[#ff1010]">Montar</span>
                        <Link
                          href="/m/meio-a-meio"
                          aria-label="Montar pizza meio a meio"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
                        >
                          +
                        </Link>
                      </div>
                    </article>
                  ) : null}

                  {activeProducts.map(renderProductCard)}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      <PromoBalloons
        storeId={catalog?.store.id || ""}
        variant="app"
        onOpenProduct={(productId) => router.push(`/m/produto/${productId}`)}
      />

      <AppBottomNav />

      {needsStore ? (
        <StorePicker open automatic />
      ) : (
        <StorePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      )}
    </main>
  );
}
