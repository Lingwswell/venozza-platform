"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  Clock3,
  MapPin,
  Search,
  ShoppingBag,
  Star,
} from "lucide-react";
import { addToCart, getCartCountByStore, purgeLegacyCartItems } from "@/lib/cart-storage";
import { heroSlides } from "@/data/home-data";
import AppBottomNav from "@/components/navigation/AppBottomNav";
import { ensureMobileStoreContext, getMobileStoreHeaders } from "@/lib/mobile-store-context";

type ApiProduct = {
  id: string | number;
  name: string;
  description?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  price?: number | string | null;
  price_cents?: number | null;
  priceCents?: number | null;
  section?: string | null;
  category?: string | null;
  categorySlug?: string | null;
  customizationType?: string | null;
  active?: boolean | null;
  available?: boolean | null;
  stock?: number | null;
  beverageGroup?: boolean;
  beverageGroupName?: string;
  beverageVariants?: ApiProduct[];
};

type ProductsResponse = {
  ok?: boolean;
  products?: ApiProduct[];
  data?: ApiProduct[];
  items?: ApiProduct[];
  error?: string;
  message?: string;
};

type MobileCategory = {
  id: string;
  label: string;
  shortName: string;
  icon: string;
  products: ApiProduct[];
};

const categoryUiMap: Record<string, { label: string; shortName: string; icon: string }> = {
  pizza: { label: "Pizzas", shortName: "Pizza", icon: "🍕" },
  pizzas: { label: "Pizzas", shortName: "Pizza", icon: "🍕" },
  bebida: { label: "Bebidas", shortName: "Bebidas", icon: "🥤" },
  bebidas: { label: "Bebidas", shortName: "Bebidas", icon: "🥤" },
  sobremesa: { label: "Sobremesas", shortName: "Sobrem.", icon: "🍰" },
  sobremesas: { label: "Sobremesas", shortName: "Sobrem.", icon: "🍰" },
  acompanhamento: { label: "Acompanhamentos", shortName: "Acomp.", icon: "🍟" },
  acompanhamentos: { label: "Acompanhamentos", shortName: "Acomp.", icon: "🍟" },
  porcao: { label: "Acompanhamentos", shortName: "Acomp.", icon: "🍟" },
  porcoes: { label: "Acompanhamentos", shortName: "Acomp.", icon: "🍟" },
};

function formatMoneyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getProductsFromPayload(payload: ProductsResponse): ApiProduct[] {
  if (Array.isArray(payload.products)) return payload.products;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function getPriceCents(product: ApiProduct) {
  if (typeof product.price_cents === "number") return product.price_cents;
  if (typeof product.priceCents === "number") return product.priceCents;

  const rawPrice =
    typeof product.price === "string"
      ? Number(product.price.replace(",", "."))
      : Number(product.price || 0);

  return Math.round(rawPrice * 100);
}

function getProductImage(product: ApiProduct) {
  return product.image || product.imageUrl || "/images/placeholder-pizza.jpg";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugifyCategory(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalCategoryKey(value: string) {
  const slug = slugifyCategory(value);

  if (
    slug === "porcao" ||
    slug === "porcoes" ||
    slug === "porcaoes" ||
    slug === "acompanhamentos"
  ) {
    return "acompanhamento";
  }

  if (slug === "bebidas") {
    return "bebida";
  }

  if (slug === "sobremesas") {
    return "sobremesa";
  }

  if (slug === "pizzas") {
    return "pizza";
  }

  return slug || "outros";
}

function getCategoryKey(product: ApiProduct) {
  const raw =
    product.categorySlug ||
    product.category ||
    product.section ||
    "outros";

  return canonicalCategoryKey(String(raw));
}

function getCategoryUi(categoryId: string) {
  const mapped = categoryUiMap[categoryId];

  if (mapped) return mapped;

  const label = categoryId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    label: label || "Outros",
    shortName: label.length > 8 ? `${label.slice(0, 7)}.` : label,
    icon: "🍽️",
  };
}

function isPizzaCategory(categoryId: string) {
  return canonicalCategoryKey(categoryId) === "pizza";
}

function isBeverageProduct(product: ApiProduct) {
  return getCategoryKey(product) === "bebida";
}

function getBeverageGroupName(product: ApiProduct) {
  const name = String(product.name || "").trim();
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

  return name
    .replace(/\b(lata|mini|garrafa|pet|retornavel|retornável|caixa)\b/gi, "")
    .replace(/\b\d+(?:[,.]\d+)?\s*(ml|l|litros|litro)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || name;
}

function getBeverageVariantLabel(product: ApiProduct) {
  const groupName = getBeverageGroupName(product);
  const label = String(product.name || "")
    .replace(new RegExp(groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
    .replace(/\s+/g, " ")
    .trim();

  return label || "Tamanho único";
}

function buildDisplayProducts(products: ApiProduct[]) {
  const result: ApiProduct[] = [];
  const beverageGroups = new Map<string, ApiProduct[]>();

  for (const product of products) {
    if (!isBeverageProduct(product)) {
      result.push(product);
      continue;
    }

    const groupName = getBeverageGroupName(product);
    beverageGroups.set(groupName, [...(beverageGroups.get(groupName) || []), product]);
  }

  for (const [groupName, variants] of beverageGroups.entries()) {
    const sortedVariants = [...variants].sort((a, b) => getPriceCents(a) - getPriceCents(b));
    const cheapest = sortedVariants[0];

    if (!cheapest) continue;

    result.push({
      ...cheapest,
      id: cheapest.id,
      name: groupName,
      description: `${sortedVariants.length} opção${sortedVariants.length === 1 ? "" : "ões"} de tamanho disponível${sortedVariants.length === 1 ? "" : "eis"}.`,
      price_cents: getPriceCents(cheapest),
      price: getPriceCents(cheapest) / 100,
      category: "bebida",
      categorySlug: "bebida",
      beverageGroup: true,
      beverageGroupName: groupName,
      beverageVariants: sortedVariants.map((variant) => ({
        ...variant,
        description: getBeverageVariantLabel(variant),
      })),
    });
  }

  return result;
}

function buildCategories(products: ApiProduct[]): MobileCategory[] {
  const grouped = new Map<string, ApiProduct[]>();

  for (const product of products) {
    const key = getCategoryKey(product);
    grouped.set(key, [...(grouped.get(key) || []), product]);
  }

  const preferredOrder = [
    "pizza",
    "bebida",
    "sobremesa",
    "acompanhamento",
  ];

  return Array.from(grouped.entries())
    .map(([id, categoryProducts]) => {
      const ui = getCategoryUi(id);

      return {
        id,
        label: ui.label,
        shortName: ui.shortName,
        icon: ui.icon,
        products: categoryProducts,
      };
    })
    .sort((a, b) => {
      const indexA = preferredOrder.indexOf(a.id);
      const indexB = preferredOrder.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return a.label.localeCompare(b.label, "pt-BR");
    });
}

export default function MobileAppPage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [storeName, setStoreName] = useState("VenoZza");
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  const displayProducts = useMemo(() => buildDisplayProducts(products), [products]);

  const mobileCategories = useMemo(() => buildCategories(displayProducts), [displayProducts]);

  const activeCategory = useMemo(() => {
    if (mobileCategories.length === 0) return null;

    return (
      mobileCategories.find((category) => category.id === activeCategoryId) ||
      mobileCategories[0]
    );
  }, [mobileCategories, activeCategoryId]);

  useEffect(() => {
    if (mobileCategories.length === 0) {
      setActiveCategoryId("");
      return;
    }

    const exists = mobileCategories.some((category) => category.id === activeCategoryId);

    if (!activeCategoryId || !exists) {
      setActiveCategoryId(mobileCategories[0].id);
    }
  }, [mobileCategories, activeCategoryId]);

  function selectCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
  }


  async function loadProducts() {
    setLoadingProducts(true);
    setProductsError("");

    try {
      const headers = getMobileStoreHeaders();

      const response = await fetch("/api/products", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as ProductsResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            payload.message ||
            `Erro ao carregar produtos. HTTP ${response.status}`
        );
      }

      const nextProducts = getProductsFromPayload(payload).filter(
        (product) => product.active !== false && product.available !== false
      );

      setProducts(nextProducts);
    } catch (error) {
      console.error("[mobile][products]", error);
      setProductsError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar produtos desta loja."
      );
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    const mobileStore = ensureMobileStoreContext();

    purgeLegacyCartItems();
    setStoreName(mobileStore.storeName);
    setCartCount(getCartCountByStore(mobileStore.storeId));
    loadProducts();

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const slide = heroSlides[activeSlide];

  function handleAdd(product: ApiProduct) {
    const priceCents = getPriceCents(product);
    const mobileStore = ensureMobileStoreContext();

    addToCart({
      id: product.id,
      name: product.name,
      quantity: 1,
      price_cents: priceCents,
      image: getProductImage(product),
      tenantId: mobileStore.tenantId,
      storeId: mobileStore.storeId,
    });

    setCartCount(getCartCountByStore(mobileStore.storeId));
  }

  return (
    <main className="min-h-screen bg-[#f7f1ef] pb-32 text-[#171717]">
      <style jsx global>{`
        @keyframes categoryFade {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      <div className="mx-auto w-full max-w-md px-4 pb-40 pt-3">
        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-gradient-to-br from-[#ff2a1f] to-[#c90816] text-2xl shadow-[0_10px_25px_rgba(214,23,23,0.28)]">
                🍕
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[17px] font-black text-[#171717]">
                    VenoZza
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#d61717]" />
                </div>

                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#767676]">
                  <MapPin className="h-3.5 w-3.5 text-[#d61717]" />
                  <span className="truncate">{storeName}</span>
                </div>
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Notificações"
                className="relative grid h-11 w-11 place-items-center rounded-[16px] border border-[#eee2dc] bg-white text-[#363636] shadow-sm transition active:scale-95"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff201c] ring-2 ring-white" />
              </button>

              <Link
                href="/m/carrinho"
                aria-label="Abrir carrinho"
                className="relative grid h-11 w-11 place-items-center rounded-[16px] bg-[#171717] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition active:scale-95"
              >
                <ShoppingBag className="h-5 w-5" />

                {cartCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff201c] px-1 text-[10px] font-black text-white ring-2 ring-[#f7f1ef]">
                    {cartCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-4">
          <label className="flex items-center gap-3 rounded-[20px] border border-[#eee3de] bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(50,30,20,0.05)] transition focus-within:border-[#ff2a1f]/40 focus-within:ring-4 focus-within:ring-[#ff2a1f]/5">
            <Search className="h-5 w-5 shrink-0 text-[#d61717]" />

            <input
              type="search"
              placeholder="Buscar pizza, bebida ou sobremesa"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#222] outline-none placeholder:text-[#9a918d]"
            />
          </label>
        </section>

        <section className="mb-6">
          <div className="relative isolate overflow-hidden rounded-[28px] bg-[#171717] px-5 py-6 text-white shadow-[0_18px_45px_rgba(21,12,10,0.22)]">
            <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#ff271d]/35 blur-2xl" />
            <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[#ff9b32]/20 blur-3xl" />

            <div className="relative z-10 max-w-[75%]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-[#ffc354] text-[#ffc354]" />
                {slide.tag}
              </span>

              <h1 className="mt-4 text-[25px] font-black leading-[1.08] tracking-[-0.03em]">
                {slide.title}
              </h1>

              <p className="mt-3 text-xs font-medium leading-relaxed text-white/72">
                {slide.description}
              </p>

              <button
                type="button"
                className="mt-5 rounded-[14px] bg-gradient-to-r from-[#ff2c20] to-[#dc0718] px-5 py-3 text-xs font-black text-white shadow-[0_10px_22px_rgba(255,37,30,0.28)] transition active:scale-95"
              >
                {slide.cta}
              </button>
            </div>

            <div className="absolute bottom-5 right-5 grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/5 text-5xl shadow-inner backdrop-blur">
              🍕
            </div>

            <div className="absolute bottom-4 right-[105px] flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/85 backdrop-blur">
              <Clock3 className="h-3 w-3" />
              30–45 min
            </div>
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveSlide(index)}
                aria-label={`Abrir oferta ${index + 1}`}
                className={[
                  "h-1.5 rounded-full transition-all",
                  index === activeSlide
                    ? "w-7 bg-[#d61717]"
                    : "w-1.5 bg-[#d9ceca]",
                ].join(" ")}
              />
            ))}
          </div>
        </section>

        {mobileCategories.length > 0 ? (
          <section className="mb-7">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d61717]">
                  Cardápio
                </p>
                <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[#171717]">
                  Escolha uma categoria
                </h2>
              </div>

              <span className="text-[11px] font-bold text-[#89817e]">
                {displayProducts.length} produtos
              </span>
            </div>

            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mobileCategories.map((cat) => {
                const selected = activeCategory?.id === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => selectCategory(cat.id)}
                    className={[
                      "flex min-w-[92px] shrink-0 flex-col items-center rounded-[22px] border px-3 py-4 text-center shadow-sm transition active:scale-95",
                      selected
                        ? "border-[#d61717] bg-[#d61717] text-white shadow-[0_12px_26px_rgba(214,23,23,0.22)]"
                        : "border-[#eee3de] bg-white text-[#262626]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid h-12 w-12 place-items-center rounded-[17px] text-2xl transition",
                        selected
                          ? "bg-white/15"
                          : "bg-[#fff2ed]",
                      ].join(" ")}
                    >
                      {cat.icon}
                    </span>

                    <span className="mt-2.5 text-[11px] font-black">
                      {cat.shortName}
                    </span>

                    <span
                      className={[
                        "mt-1 text-[9px] font-bold",
                        selected ? "text-white/70" : "text-[#9b918d]",
                      ].join(" ")}
                    >
                      {cat.products.length} itens
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {loadingProducts ? (
          <div className="rounded-[22px] border border-[#eadfda] bg-white p-4 text-sm font-bold text-[#666] shadow-sm">
            Carregando produtos da loja...
          </div>
        ) : productsError ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
            {productsError}
          </div>
        ) : mobileCategories.length === 0 ? (
          <div className="rounded-[22px] border border-[#eadfda] bg-white p-4 text-sm font-bold text-[#666] shadow-sm">
            Nenhum produto disponível para esta loja no momento.
          </div>
        ) : (
          <div className="space-y-8">
            {activeCategory ? (
              <section
                key={activeCategory.id}
                id={activeCategory.id}
                className="animate-[categoryFade_.22s_ease-out]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[18px] font-black">{activeCategory.label}</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {isPizzaCategory(activeCategory.id) ? (
                    <article className="overflow-hidden rounded-[22px] border border-[#eadfda] bg-white shadow-sm">
                      <Link href="/m/meio-a-meio" className="block p-3 pb-0">
                        <div className="flex h-24 w-full items-center justify-center rounded-[16px] bg-[#fff1f1] text-4xl">
                          🍕
                        </div>

                        <h3 className="mt-3 text-sm font-black leading-tight text-[#171717]">
                          Pizza Meio a Meio 40cm
                        </h3>

                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6f6f6f]">
                          Monte uma pizza família com até 2 sabores.
                        </p>
                      </Link>

                      <div className="flex items-center justify-between gap-2 p-3 pt-2">
                        <span className="text-[15px] font-black text-[#ff1010]">
                          Montar
                        </span>

                        <Link
                          href="/m/meio-a-meio"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
                        >
                          +
                        </Link>
                      </div>
                    </article>
                  ) : null}

                  {activeCategory.products.map((product) => {
                    const priceCents = getPriceCents(product);
                    const isBeverageGroup = product.beverageGroup === true;

                    return (
                      <article
                        key={String(product.id)}
                        className="overflow-hidden rounded-[22px] border border-[#eadfda] bg-white shadow-sm"
                      >
                        <Link
                          href={`/m/produto/${product.id}`}
                          className="block p-3 pb-0"
                        >
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="h-24 w-full rounded-[16px] object-cover"
                          />

                          <h3 className="mt-3 text-sm font-black leading-tight text-[#171717]">
                            {product.name}
                          </h3>

                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#6f6f6f]">
                            {product.description || "Produto disponível nesta loja."}
                          </p>
                        </Link>

                        <div className="flex items-center justify-between gap-2 p-3 pt-2">
                          <span className="text-[15px] font-black text-[#ff1010]">
                            {isBeverageGroup ? "A partir de " : ""}
                            {formatMoneyFromCents(priceCents)}
                          </span>

                          {isBeverageGroup ? (
                            <Link
                              href={`/m/produto/${product.id}`}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
                            >
                              +
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAdd(product)}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff1010] text-[24px] font-black leading-none text-white shadow-md transition active:scale-95"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <AppBottomNav />
    </main>
  );
}
