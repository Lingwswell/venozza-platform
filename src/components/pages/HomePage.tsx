"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin, MessageCircle, Plus, Search, ShoppingBag } from "lucide-react";
import {
  CART_CHANGED_EVENT,
  addToCart,
  getCartItemsByStore,
  purgeLegacyCartItems,
} from "@/lib/cart-storage";
import { ensureMobileStoreContext } from "@/lib/mobile-store-context";
import { normalizeText } from "@/lib/catalog/category";
import {
  formatDeliveryWindow,
  pickFeatured,
  productImage,
  useStoreCatalog,
  type CatalogProduct,
} from "@/lib/catalog/use-store-catalog";
import type { CartItem } from "@/types/order";
import StorePicker from "@/components/store/StorePicker";
import Plate from "@/components/site/Plate";
import SiteCart from "@/components/site/SiteCart";
import SiteDialog from "@/components/site/SiteDialog";
import ProductDialog from "@/components/site/ProductDialog";
import HalfHalfDialog from "@/components/site/HalfHalfDialog";
import { detectProductKind } from "@/lib/catalog/cart-items";
import { displayFont } from "@/lib/fonts";

// Site da loja (computador). Mesma fonte de dados do app: /api/catalog.
// Tudo que aparece (marca, loja, cardapio, precos, regras) vem do banco.

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pizza e batata abrem a janela de escolha (dentro do site); o resto vai direto ao carrinho.
function needsChoice(product: CatalogProduct) {
  const kind = detectProductKind(product);
  return kind === "pizza" || kind === "batata";
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8171E]";

export function HomePage() {
  const { catalog, loading, error, needsStore } = useStoreCatalog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState<CatalogProduct | null>(null);
  const [halfHalfOpen, setHalfHalfOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? "" : t)), 2200);
  }

  function openOrAdd(product: CatalogProduct) {
    if (needsChoice(product)) setOpenProduct(product);
    else handleAdd(product);
  }

  const storeId = catalog?.store.id || "";

  useEffect(() => {
    purgeLegacyCartItems();
  }, []);

  // Carrinho da loja atual, atualizado quando qualquer tela mexe nele.
  useEffect(() => {
    if (!storeId) return;
    const reload = () => setCartItems(getCartItemsByStore(storeId));
    reload();
    window.addEventListener(CART_CHANGED_EVENT, reload);
    window.addEventListener("storage", reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, reload);
      window.removeEventListener("storage", reload);
      window.removeEventListener("focus", reload);
    };
  }, [storeId]);

  const categories = useMemo(
    () => (catalog?.categories || []).filter((c) => c.showInSite),
    [catalog]
  );

  const products = useMemo(() => {
    const keys = new Set(categories.map((c) => c.key));
    const term = normalizeText(search);
    return (catalog?.products || []).filter(
      (p) =>
        keys.has(p.category) &&
        (!term || normalizeText(`${p.name} ${p.description || ""}`).includes(term))
    );
  }, [catalog, categories, search]);

  const featured = useMemo(() => pickFeatured(catalog?.products || [], 3), [catalog]);

  // Destaca no menu de categorias a secao que esta na tela.
  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActiveCat(visible[0].target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" }
    );
    for (const c of categories) {
      const el = document.getElementById(`cat-${c.key}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories, search]);

  function handleAdd(product: CatalogProduct) {
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
    setJustAdded(product.id);
    setTimeout(() => setJustAdded((c) => (c === product.id ? null : c)), 1400);
    showToast(`${product.name} adicionado ao pedido`);
  }

  const pizzas = useMemo(
    () => (catalog?.products || []).filter((p) => detectProductKind(p) === "pizza"),
    [catalog]
  );

  const brand = catalog?.store.brandName || "";
  const settings = catalog?.settings;
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const whatsappHref = settings?.whatsapp
    ? `https://wa.me/55${settings.whatsapp.replace(/^55/, "")}`
    : null;

  return (
    <main className="min-h-screen bg-[#FCFBF9] text-[#1F1A17]">
      {/* Barra do topo */}
      <header className="sticky top-0 z-40 border-b border-[#ECE6DF] bg-[#FCFBF9]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/" className={`${displayFont.className} ${focusRing} shrink-0 rounded text-xl font-extrabold text-[#C8171E]`}>
            {brand || " "}
          </Link>

          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#ECE6DF] bg-white px-4 py-2.5 focus-within:border-[#C8171E]">
            <Search className="h-4 w-4 shrink-0 text-[#857A71]" />
            <span className="sr-only">Buscar no cardápio</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pizza, bebida, sobremesa"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#A79C93]"
            />
          </label>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Abrir pedido (${cartCount} itens)`}
            className={`${focusRing} relative flex shrink-0 items-center gap-2 rounded-full bg-[#1F1A17] px-4 py-2.5 text-sm font-semibold text-white lg:hidden`}
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 ? cartCount : null}
          </button>
        </div>

        {categories.length > 1 && !search ? (
          <nav aria-label="Categorias do cardápio" className="mx-auto max-w-6xl px-5">
            <ul className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]">
              {categories.map((cat) => (
                <li key={cat.key}>
                  <a
                    href={`#cat-${cat.key}`}
                    className={[
                      focusRing,
                      "block whitespace-nowrap border-b-2 py-2.5 text-sm font-semibold transition-colors",
                      activeCat === cat.key
                        ? "border-[#C8171E] text-[#1F1A17]"
                        : "border-transparent text-[#857A71] hover:text-[#1F1A17]",
                    ].join(" ")}
                  >
                    {cat.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {/* Abertura: marca, loja, regras de entrega e os pratos em destaque */}
      {catalog && !search ? (
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-8 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
          <div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${focusRing} inline-flex items-center gap-2 rounded-full border border-[#ECE6DF] bg-white px-3.5 py-1.5 text-sm text-[#4A423C] hover:border-[#C8171E]`}
            >
              <MapPin className="h-4 w-4 text-[#C8171E]" />
              {catalog.store.name}
              <span className="font-semibold text-[#C8171E]">Trocar</span>
            </button>

            <h1
              className={`${displayFont.className} mt-5 text-[clamp(3rem,7vw,5.5rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-[#1F1A17]`}
            >
              {brand}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-[#4A423C]">
              <span className="inline-flex items-center gap-2 font-semibold">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 rounded-full ${catalog.status.open ? "bg-[#2E7D4F]" : "bg-[#C8171E]"}`}
                />
                <span className={catalog.status.open ? "text-[#2E7D4F]" : "text-[#A3141A]"}>
                  {catalog.status.open ? "Aberta agora" : catalog.status.message}
                </span>
              </span>
              <span>Entrega em {formatDeliveryWindow(catalog.settings)}</span>
              <span>
                {catalog.settings.deliveryFeeCents > 0
                  ? `Taxa ${money(catalog.settings.deliveryFeeCents)}`
                  : "Entrega grátis"}
                {catalog.settings.freeDeliveryAboveCents
                  ? `, grátis acima de ${money(catalog.settings.freeDeliveryAboveCents)}`
                  : ""}
              </span>
              {catalog.settings.minimumOrderCents > 0 ? (
                <span>Pedido mínimo {money(catalog.settings.minimumOrderCents)}</span>
              ) : null}
            </div>

            {catalog.paymentMethods.length > 0 ? (
              <p className="mt-3 text-sm text-[#857A71]">
                Pague na entrega com {catalog.paymentMethods.map((m) => m.label).join(", ")}.
              </p>
            ) : null}

            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={`${focusRing} mt-5 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-[#2E7D4F] hover:underline`}
              >
                <MessageCircle className="h-4 w-4" />
                Falar com a loja no WhatsApp
              </a>
            ) : null}
          </div>

          {featured.length > 0 ? (
            <div className="relative mx-auto flex h-[340px] w-full max-w-[460px] items-center justify-center">
              {featured.map((product, index) => {
                // Pratos sobrepostos: o principal grande no centro, os outros menores ao lado.
                const layout = [
                  { size: 250, style: { left: "50%", top: "46%", transform: "translate(-50%,-50%)", zIndex: 3 } },
                  { size: 150, style: { left: "2%", top: "62%", zIndex: 2 } },
                  { size: 140, style: { right: "0%", top: "4%", zIndex: 1 } },
                ][index];
                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => openOrAdd(product)}
                    className={`${focusRing} group absolute rounded-full ${index > 0 ? "hidden sm:block" : ""}`}
                    style={layout.style}
                    aria-label={`${product.name}, ${money(product.price_cents)}`}
                  >
                    <Plate
                      src={product.image}
                      name={product.name}
                      size={layout.size}
                      className="shadow-[0_18px_40px_rgba(70,40,20,0.22)] transition-transform group-hover:scale-[1.03]"
                    />
                    <span
                      className={[
                        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1F1A17] shadow-sm",
                        index === 0 ? "-bottom-3" : "-bottom-2",
                      ].join(" ")}
                    >
                      {product.name} <span className="text-[#C8171E]">{money(product.price_cents)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Cardapio + carrinho */}
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-28 pt-4 lg:grid-cols-[1fr_340px]">
        <div>
          {needsStore ? null : loading ? (
            <p className="py-10 text-[#857A71]">Carregando o cardápio...</p>
          ) : error ? (
            <p className="rounded-2xl bg-[#FDEDEC] p-5 text-sm font-medium text-[#A3141A]">{error}</p>
          ) : search && products.length === 0 ? (
            <p className="py-10 text-[#857A71]">Nada encontrado para “{search}”. Tente outro nome.</p>
          ) : categories.length === 0 ? (
            <p className="py-10 text-[#857A71]">Esta loja ainda não tem produtos à venda.</p>
          ) : (
            categories.map((cat) => {
              const items = products.filter((p) => p.category === cat.key);
              if (items.length === 0) return null;

              return (
                <section key={cat.key} id={`cat-${cat.key}`} className="scroll-mt-32 pt-6">
                  <h2 className={`${displayFont.className} text-[28px] font-bold tracking-[-0.02em]`}>
                    {cat.label}
                  </h2>

                  <ul className="mt-2 divide-y divide-[#ECE6DF]">
                    {cat.key === "pizza" && !search && pizzas.length >= 2 ? (
                      <li className="flex items-center gap-5 py-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[17px] font-semibold">Pizza meio a meio</p>
                          <p className="mt-1 text-sm text-[#6B625B]">Dois sabores na mesma pizza. Você escolhe as metades.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHalfHalfOpen(true)}
                          className={`${focusRing} shrink-0 rounded-full border border-[#C8171E] px-4 py-2 text-sm font-semibold text-[#C8171E] hover:bg-[#C8171E] hover:text-white`}
                        >
                          Montar
                        </button>
                      </li>
                    ) : null}

                    {items.map((product) => {
                      const choose = needsChoice(product);
                      return (
                        <li key={product.id} className="flex items-center gap-5 py-5">
                          <button
                            type="button"
                            onClick={() => openOrAdd(product)}
                            className={`${focusRing} min-w-0 flex-1 rounded-lg text-left`}
                          >
                            <div className="flex items-baseline gap-3">
                              <span className="text-[17px] font-semibold">{product.name}</span>
                              <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-[#D4C9BE]" />
                              <span className="whitespace-nowrap text-[17px] font-semibold text-[#C8171E]">
                                {choose && product.category === "pizza" ? "a partir de " : ""}
                                {money(product.price_cents)}
                              </span>
                            </div>
                            {product.description ? (
                              <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-[#6B625B]">
                                {product.description}
                              </p>
                            ) : null}
                          </button>

                          <div className="relative shrink-0">
                            <Plate src={product.image} name={product.name} size={88} />
                            {choose ? (
                              <button
                                type="button"
                                onClick={() => setOpenProduct(product)}
                                aria-label={`Escolher opções de ${product.name}`}
                                className={`${focusRing} absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-[#C8171E] text-white shadow-md hover:bg-[#A9121A]`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAdd(product)}
                                aria-label={`Adicionar ${product.name} ao carrinho`}
                                className={[
                                  focusRing,
                                  "absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full text-white shadow-md transition-colors",
                                  justAdded === product.id ? "bg-[#2E7D4F]" : "bg-[#C8171E] hover:bg-[#A9121A]",
                                ].join(" ")}
                              >
                                {justAdded === product.id ? <span className="text-sm font-bold">✓</span> : <Plus className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-32">
            <SiteCart items={cartItems} catalog={catalog} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-[#ECE6DF]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-[#857A71] sm:flex-row sm:justify-between">
          <span>
            {brand} {catalog ? `— ${catalog.store.name}` : ""}
          </span>
          <div className="flex gap-5">
            <Link href="/admin/login" className={`${focusRing} rounded hover:text-[#1F1A17]`}>Área do lojista</Link>
          </div>
        </div>
      </footer>

      {/* Celular/tablet: barra do carrinho */}
      {cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 px-5 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className={`${focusRing} mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-[#C8171E] px-6 py-4 text-sm font-bold text-white shadow-[0_16px_40px_rgba(200,23,30,0.35)]`}
          >
            <span>Ver pedido ({cartCount})</span>
            <span>{money(cartItems.reduce((s, i) => s + Number(i.price_cents || 0) * i.quantity, 0))}</span>
          </button>
        </div>
      ) : null}

      <ProductDialog product={openProduct} onClose={() => setOpenProduct(null)} onAdded={(name) => showToast(`${name} adicionado ao pedido`)} />
      <HalfHalfDialog
        open={halfHalfOpen}
        pizzas={pizzas}
        onClose={() => setHalfHalfOpen(false)}
        onAdded={(name) => showToast(`${name} adicionada ao pedido`)}
      />
      <SiteDialog open={cartOpen} onClose={() => setCartOpen(false)} label="Seu pedido">
        <div className="p-4 pt-14">
          <SiteCart items={cartItems} catalog={catalog} />
        </div>
      </SiteDialog>

      {toast ? (
        <div role="status" className="fixed left-1/2 top-20 z-[95] -translate-x-1/2 rounded-full bg-[#1F1A17] px-5 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {needsStore ? (
        <StorePicker open automatic />
      ) : (
        <StorePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      )}
    </main>
  );
}
