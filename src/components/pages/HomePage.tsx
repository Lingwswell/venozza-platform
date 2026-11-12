"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Banknote, Bike, Check, Clock3, MapPin, MessageCircle, Plus, Search, ShoppingBag, ShoppingCart } from "lucide-react";
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
import FeaturedPlates from "@/components/site/FeaturedPlates";
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
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C]";

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

  const featured = useMemo(() => pickFeatured(catalog?.products || [], 5), [catalog]);

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

  const statusOpen = catalog?.status.open ?? true;
  const facts: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = settings
    ? [
        { label: "Entrega", value: formatDeliveryWindow(settings), icon: Clock3 },
        {
          label: "Taxa de entrega",
          icon: Bike,
          value:
            settings.deliveryFeeCents > 0
              ? settings.freeDeliveryAboveCents
                ? `${money(settings.deliveryFeeCents)} (grátis acima de ${money(settings.freeDeliveryAboveCents)})`
                : money(settings.deliveryFeeCents)
              : "Grátis",
        },
        {
          label: "Pedido mínimo",
          icon: ShoppingCart,
          value: settings.minimumOrderCents > 0 ? money(settings.minimumOrderCents) : "Sem mínimo",
        },
        ...(catalog && catalog.paymentMethods.length > 0
          ? [
              {
                label: "Pagamento na entrega",
                icon: Banknote,
                value: catalog.paymentMethods
                  .map((m) => m.label)
                  .join(", ")
                  .replace(/, ([^,]*)$/, " ou $1"),
              },
            ]
          : []),
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#F6F5F2] font-sans text-[#1C1917]">
      {/* Topo (fixo) */}
      <header className="sticky top-0 z-40 h-[76px] border-b border-[#E7E5E4] bg-white">
        <div className="mx-auto flex h-full max-w-[1200px] items-center gap-6 px-6">
          <Link href="/" className={`${displayFont.className} ${focusRing} shrink-0 rounded text-[26px] font-extrabold tracking-[-0.02em] text-[#B91C1C]`}>
            {brand || " "}
          </Link>

          <label className="flex w-full max-w-[520px] min-w-0 items-center gap-2.5 rounded-full border border-[#E7E5E4] bg-[#F6F5F2] px-[18px] py-3 focus-within:border-[#B91C1C] focus-within:bg-white">
            <Search className="h-[18px] w-[18px] shrink-0 text-[#8A8580]" />
            <span className="sr-only">Buscar no cardápio</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pizza, bebida, sobremesa"
              className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-[#8A8580]"
            />
          </label>

          <div className="flex-1" />

          {catalog ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${focusRing} hidden shrink-0 items-center gap-2 rounded-full border border-[#E7E5E4] bg-white py-2.5 pl-3.5 pr-4 text-[15px] hover:border-[#B91C1C] md:inline-flex`}
            >
              <MapPin className="h-[18px] w-[18px] text-[#B91C1C]" />
              <span className="font-medium">{catalog.store.name}</span>
              <span className="font-semibold text-[#B91C1C]">Trocar</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Abrir pedido (${cartCount} itens)`}
            className={`${focusRing} relative flex shrink-0 items-center gap-2 rounded-full bg-[#1C1917] px-4 py-2.5 text-sm font-semibold text-white lg:hidden`}
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 ? cartCount : null}
          </button>
        </div>
      </header>

      {/* Abertura: a marca e os pratos em destaque */}
      {catalog && !search ? (
        <section className="bg-[#1C1917] text-white">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 py-16 lg:grid-cols-[1fr_520px]">
            <div>
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full py-[7px] pl-3 pr-3.5 text-sm font-semibold",
                  statusOpen ? "bg-[#14532D]/60 text-[#BBF7D0]" : "bg-[#7F1D1D]/60 text-[#FECACA]",
                ].join(" ")}
              >
                <span aria-hidden className={`h-2 w-2 rounded-full ${statusOpen ? "bg-[#4ADE80]" : "bg-[#F87171]"}`} />
                {statusOpen ? "Aberta agora" : catalog.status.message}
              </span>

              <h1
                className={`${displayFont.className} mt-5 text-[clamp(3.5rem,9vw,7.5rem)] font-extrabold leading-[0.93] tracking-[-0.04em]`}
              >
                {brand}
              </h1>

              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-[#D6D3D1] md:text-xl">
                Peça online na {catalog.store.name} e acompanhe o pedido até a sua porta.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a
                  href="#cardapio"
                  className="inline-flex items-center gap-2 rounded-full bg-[#B91C1C] px-7 py-4 text-base font-bold text-white shadow-[0_10px_30px_rgba(185,28,28,0.35)] hover:bg-[#991B1B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Ver o cardápio
                  <ArrowDown aria-hidden className="h-[18px] w-[18px]" />
                </a>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-semibold text-[#D6D3D1] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Falar com a loja
                  </a>
                ) : null}
              </div>
            </div>

            <FeaturedPlates products={featured} onSelect={openOrAdd} />
          </div>
        </section>
      ) : null}

      {/* Informações da loja */}
      {facts.length > 0 && !search ? (
        <section className="border-b border-[#E7E5E4] bg-white">
          <dl className="mx-auto flex max-w-[1200px] flex-wrap px-6">
            {facts.map((f, i) => (
              <div
                key={f.label}
                className={[
                  "flex items-center gap-3.5 py-5 pr-8",
                  i > 0 ? "border-l border-[#E7E5E4] pl-8" : "",
                ].join(" ")}
              >
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F6F5F2] text-[#B91C1C]">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <dt className="text-sm text-[#8A8580]">{f.label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Categorias (fixas abaixo do topo) */}
      {categories.length > 1 && !search ? (
        <nav aria-label="Categorias do cardápio" className="sticky top-[76px] z-30 border-b border-[#E7E5E4] bg-[#F6F5F2]/95 backdrop-blur">
          <ul className="mx-auto flex max-w-[1200px] gap-8 overflow-x-auto px-6 pt-4 [scrollbar-width:none]">
            {categories.map((cat) => (
              <li key={cat.key}>
                <a
                  href={`#cat-${cat.key}`}
                  className={[
                    focusRing,
                    "block whitespace-nowrap border-b-[3px] pb-3 text-base transition-colors",
                    activeCat === cat.key
                      ? "border-[#B91C1C] font-semibold text-[#1C1917]"
                      : "border-transparent font-medium text-[#8A8580] hover:text-[#1C1917]",
                  ].join(" ")}
                >
                  {cat.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/* Cardápio + pedido */}
      <div id="cardapio" className="mx-auto grid max-w-[1200px] scroll-mt-32 gap-8 px-6 pb-20 pt-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {needsStore ? null : loading ? (
            <p className="py-10 text-[#8A8580]">Carregando o cardápio...</p>
          ) : error ? (
            <p className="rounded-2xl bg-[#FDEDEC] p-5 text-sm font-medium text-[#991B1B]">{error}</p>
          ) : search && products.length === 0 ? (
            <p className="py-10 text-[#8A8580]">Nada encontrado para “{search}”. Tente outro nome.</p>
          ) : categories.length === 0 ? (
            <p className="py-10 text-[#8A8580]">Esta loja ainda não tem produtos à venda.</p>
          ) : (
            categories.map((cat) => {
              const items = products.filter((p) => p.category === cat.key);
              if (items.length === 0) return null;

              return (
                <section
                  key={cat.key}
                  id={`cat-${cat.key}`}
                  className="scroll-mt-[150px] rounded-[20px] border border-[#E7E5E4] bg-white px-7 pb-2 pt-6"
                >
                  <h2 className={`${displayFont.className} mb-3 text-[30px] font-bold tracking-[-0.02em]`}>{cat.label}</h2>

                  <ul>
                    {cat.key === "pizza" && !search && pizzas.length >= 2 ? (
                      <li className="flex items-center gap-6 border-t border-[#E7E5E4] py-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold">Pizza meio a meio</p>
                          <p className="mt-1 text-[15px] text-[#57534E]">Dois sabores na mesma pizza. Você escolhe as metades; o preço é o do sabor mais caro.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHalfHalfOpen(true)}
                          className={`${focusRing} shrink-0 rounded-full border-[1.5px] border-[#B91C1C] px-5 py-2.5 text-[15px] font-semibold text-[#B91C1C] hover:bg-[#B91C1C] hover:text-white`}
                        >
                          Montar
                        </button>
                      </li>
                    ) : null}

                    {items.map((product) => {
                      const choose = needsChoice(product);
                      return (
                        <li key={product.id} className="flex items-center gap-6 border-t border-[#E7E5E4] py-5">
                          <button
                            type="button"
                            onClick={() => openOrAdd(product)}
                            className={`${focusRing} min-w-0 flex-1 rounded-lg text-left`}
                          >
                            <span className="flex items-baseline gap-3">
                              <span className="text-lg font-semibold">{product.name}</span>
                              <span aria-hidden className="mb-1.5 flex-1 border-b border-dotted border-[#D6D0C8]" />
                              <span className="whitespace-nowrap text-lg font-semibold text-[#B91C1C]">
                                {choose && detectProductKind(product) === "pizza" ? "a partir de " : ""}
                                {money(product.price_cents)}
                              </span>
                            </span>
                            {product.description ? (
                              <span className="mt-1.5 block max-w-[60ch] text-[15px] leading-relaxed text-[#57534E]">
                                {product.description}
                              </span>
                            ) : null}
                          </button>

                          <div className="relative shrink-0">
                            <Plate src={product.image} name={product.name} size={88} ring={3} />
                            <button
                              type="button"
                              onClick={() => openOrAdd(product)}
                              aria-label={choose ? `Escolher opções de ${product.name}` : `Adicionar ${product.name} ao pedido`}
                              className={[
                                focusRing,
                                "absolute -bottom-1 -right-1 grid h-[38px] w-[38px] place-items-center rounded-full text-white shadow-[0_4px_10px_rgba(185,28,28,0.3)] transition-colors",
                                justAdded === product.id ? "bg-[#15803D]" : "bg-[#B91C1C] hover:bg-[#991B1B]",
                              ].join(" ")}
                            >
                              {justAdded === product.id ? <Check className="h-[18px] w-[18px]" /> : <Plus className="h-[18px] w-[18px]" />}
                            </button>
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
          <div className="sticky top-[150px]">
            <SiteCart items={cartItems} catalog={catalog} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-[#E7E5E4] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-7 text-sm text-[#8A8580] sm:flex-row sm:justify-between">
          <span>
            <span className="font-semibold text-[#1C1917]">{brand}</span>
            {catalog ? ` — ${catalog.store.name}` : ""}
            {catalog?.store.address ? `, ${catalog.store.address}` : ""}
          </span>
          <Link href="/admin/login" className={`${focusRing} rounded font-medium hover:text-[#1C1917]`}>Área do lojista</Link>
        </div>
      </footer>

      {/* Telas menores: barra do pedido */}
      {cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 px-5 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className={`${focusRing} mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-[#B91C1C] px-6 py-4 text-sm font-bold text-white shadow-[0_16px_40px_rgba(185,28,28,0.35)]`}
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
        <div role="status" className="fixed left-1/2 top-24 z-[95] -translate-x-1/2 rounded-full bg-[#1C1917] px-5 py-3 text-sm font-semibold text-white shadow-lg">
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
