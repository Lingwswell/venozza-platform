"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, MessageCircle, Search, ShoppingBag, Wallet } from "lucide-react";
import { addToCart, getCartCountByStore, purgeLegacyCartItems } from "@/lib/cart-storage";
import { ensureMobileStoreContext } from "@/lib/mobile-store-context";
import StorePicker from "@/components/store/StorePicker";
import { normalizeText } from "@/lib/catalog/category";
import {
  formatDeliveryWindow,
  pickFeatured,
  handleProductImageError,
  productImage,
  useStoreCatalog,
  type CatalogProduct,
} from "@/lib/catalog/use-store-catalog";

// Site (versao desktop). Mesma fonte de dados do app: /api/catalog.
// Nenhum produto, preco, promocao ou nota fica escrito aqui.

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pizzas abrem a pagina do produto para escolher tamanho/borda; o resto vai direto ao carrinho.
function needsChoice(product: CatalogProduct) {
  return product.category === "pizza" || product.customizationType !== "auto";
}

export function HomePage() {
  const { catalog, loading, error, needsStore } = useStoreCatalog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    purgeLegacyCartItems();
  }, []);

  useEffect(() => {
    if (catalog) setCartCount(getCartCountByStore(catalog.store.id));
  }, [catalog]);

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

  const featured = useMemo(
    () => pickFeatured(products.length ? products : catalog?.products || [], 4),
    [products, catalog]
  );

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
    setCartCount(getCartCountByStore(store.storeId));
    setAddedId(product.id);
    setTimeout(() => setAddedId((current) => (current === product.id ? null : current)), 1500);
  }

  const brand = catalog?.store.brandName || "";
  const settings = catalog?.settings;
  const whatsappHref = settings?.whatsapp ? `https://wa.me/55${settings.whatsapp.replace(/^55/, "")}` : null;

  return (
    <main className="min-h-screen bg-[#fff8f2] text-[#1f1b16]">
      <header className="sticky top-0 z-50 border-b border-[#eee2d5] bg-[#fff8f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <Link href="/" className="block truncate text-2xl font-black tracking-tight text-[#b3261e]">
              {brand || " "}
            </Link>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 truncate text-xs text-[#6e6257] hover:text-[#b3261e] md:text-sm"
            >
              <MapPin className="h-3.5 w-3.5 text-[#b3261e]" />
              {catalog
                ? `${catalog.store.name}${catalog.store.city ? ` · ${catalog.store.city}` : ""}`
                : "Escolha a loja"}
              <span className="font-semibold underline">trocar</span>
            </button>
          </div>

          <label className="hidden flex-1 justify-center md:flex">
            <span className="flex w-full max-w-xl items-center gap-3 rounded-full border border-[#eadbcc] bg-white px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 text-[#b3261e]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar no cardápio"
                className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[#9b8f84]"
              />
            </span>
          </label>

          <Link
            href="/m/carrinho"
            className="relative flex items-center gap-2 rounded-full bg-[#1f1b16] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            Carrinho
            {cartCount > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#e3342a] px-1 text-[11px] font-black">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="border-t border-[#f0e5da] px-4 py-3 md:hidden">
          <label className="mx-auto flex max-w-7xl items-center gap-3 rounded-full border border-[#eadbcc] bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-[#b3261e]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio"
              className="w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-[#9b8f84]"
            />
          </label>
        </div>

        {categories.length > 1 && !search ? (
          <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:px-8 [scrollbar-width:none]">
            {categories.map((cat) => (
              <a
                key={cat.key}
                href={`#cat-${cat.key}`}
                className="shrink-0 rounded-full border border-[#eadbcc] bg-white px-4 py-2 text-sm font-semibold text-[#3d342c] transition hover:border-[#b3261e] hover:text-[#b3261e]"
              >
                {cat.icon} {cat.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:px-8">
        {catalog && !catalog.status.open ? (
          <div className="mb-6 rounded-3xl border border-[#ffd2cc] bg-[#fff1ef] px-6 py-4 text-base font-bold text-[#b3261e]">
            {catalog.status.message}
          </div>
        ) : null}

        {settings ? (
          <section className="mb-8 flex flex-wrap gap-3 text-sm font-semibold text-[#5f5348]">
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
              <Clock3 className="h-4 w-4 text-[#b3261e]" />
              Entrega em {formatDeliveryWindow(settings)}
            </span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              Taxa de entrega: {settings.deliveryFeeCents > 0 ? money(settings.deliveryFeeCents) : "grátis"}
              {settings.freeDeliveryAboveCents ? ` · grátis acima de ${money(settings.freeDeliveryAboveCents)}` : ""}
            </span>
            {settings.minimumOrderCents > 0 ? (
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                Pedido mínimo: {money(settings.minimumOrderCents)}
              </span>
            ) : null}
            {catalog?.paymentMethods.length ? (
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                <Wallet className="h-4 w-4 text-[#b3261e]" />
                {catalog.paymentMethods.map((m) => m.label).join(" · ")}
              </span>
            ) : null}
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm hover:text-[#b3261e]"
              >
                <MessageCircle className="h-4 w-4 text-[#1f9d55]" />
                WhatsApp
              </a>
            ) : null}
          </section>
        ) : null}

        {needsStore ? null : loading ? (
          <p className="rounded-3xl bg-white p-6 text-sm font-semibold text-[#6e6257] shadow-sm">Carregando cardápio...</p>
        ) : error ? (
          <p className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <>
            {featured.length > 0 && !search ? (
              <section className="mb-12">
                <h2 className="mb-4 text-2xl font-black tracking-tight">Destaques</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {featured.map((product, index) => (
                    <Link
                      key={product.id}
                      href={`/m/produto/${product.id}`}
                      className={[
                        "group relative overflow-hidden rounded-[28px] bg-[#1f1b16] text-white shadow-[0_18px_45px_rgba(31,27,22,0.18)]",
                        index === 0 ? "md:col-span-2 md:row-span-2" : "",
                      ].join(" ")}
                    >
                      <img
                        src={productImage(product)}
                        onError={handleProductImageError}
                        alt={product.name}
                        className={[
                          "w-full object-cover opacity-90 transition group-hover:scale-[1.03]",
                          index === 0 ? "h-64 md:h-full md:min-h-[340px]" : "h-44",
                        ].join(" ")}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5">
                        <p className={index === 0 ? "text-2xl font-black" : "text-lg font-black"}>{product.name}</p>
                        <p className="mt-1 text-sm font-bold text-[#ffd2a8]">{money(product.price_cents)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {search ? (
              <p className="mb-6 text-sm font-semibold text-[#6e6257]">
                {products.length} resultado{products.length === 1 ? "" : "s"} para “{search}”
              </p>
            ) : null}

            {categories.length === 0 ? (
              <p className="rounded-3xl bg-white p-6 text-sm font-semibold text-[#6e6257] shadow-sm">
                Nenhum produto disponível nesta loja no momento.
              </p>
            ) : (
              categories.map((cat) => {
                const items = products.filter((p) => p.category === cat.key);
                if (items.length === 0) return null;

                return (
                  <section key={cat.key} id={`cat-${cat.key}`} className="mb-12 scroll-mt-40">
                    <h2 className="mb-4 text-2xl font-black tracking-tight">
                      {cat.icon} {cat.label}
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {cat.key === "pizza" && !search ? (
                        <Link
                          href="/m/meio-a-meio"
                          className="flex flex-col justify-between rounded-[24px] border border-dashed border-[#e7b9a6] bg-[#fff1ea] p-5 transition hover:border-[#b3261e]"
                        >
                          <span className="text-4xl">🍕</span>
                          <div>
                            <h3 className="mt-4 text-lg font-black">Pizza meio a meio</h3>
                            <p className="mt-1 text-sm text-[#6e6257]">Monte sua pizza com 2 sabores.</p>
                            <span className="mt-4 inline-block rounded-full bg-[#b3261e] px-4 py-2 text-sm font-bold text-white">
                              Montar
                            </span>
                          </div>
                        </Link>
                      ) : null}

                      {items.map((product) => (
                        <article
                          key={product.id}
                          className="flex flex-col overflow-hidden rounded-[24px] border border-[#efe2d6] bg-white shadow-sm transition hover:shadow-md"
                        >
                          <Link href={`/m/produto/${product.id}`}>
                            <img
                              src={productImage(product)}
                              onError={handleProductImageError}
                              alt={product.name}
                              className="h-44 w-full bg-[#fff4ef] object-cover"
                            />
                          </Link>
                          <div className="flex flex-1 flex-col p-4">
                            <h3 className="text-base font-black leading-tight">{product.name}</h3>
                            {product.description ? (
                              <p className="mt-1 line-clamp-2 text-sm text-[#6e6257]">{product.description}</p>
                            ) : null}
                            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                              <span className="text-lg font-black text-[#b3261e]">{money(product.price_cents)}</span>
                              {needsChoice(product) ? (
                                <Link
                                  href={`/m/produto/${product.id}`}
                                  className="rounded-full bg-[#b3261e] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                  Escolher
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAdd(product)}
                                  className="rounded-full bg-[#b3261e] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                                >
                                  {addedId === product.id ? "Adicionado ✓" : "Adicionar"}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>

      <footer className="border-t border-[#eee2d5] bg-[#fff3e9]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-[#6e6257] md:flex-row md:items-center md:justify-between md:px-8">
          <span>
            © {new Date().getFullYear()} {brand}
          </span>
          <div className="flex gap-4">
            <Link href="/m" className="hover:text-[#b3261e]">Abrir no celular</Link>
            <Link href="/admin/login" className="hover:text-[#b3261e]">Área do lojista</Link>
          </div>
        </div>
      </footer>

      {needsStore ? (
        <StorePicker open automatic />
      ) : (
        <StorePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      )}

      {cartCount > 0 ? (
        <div className="fixed bottom-4 left-0 right-0 z-50 px-4 md:hidden">
          <Link
            href="/m/carrinho"
            className="flex items-center justify-center rounded-full bg-[#b3261e] px-6 py-4 text-sm font-black text-white shadow-[0_20px_50px_rgba(179,38,30,0.35)]"
          >
            Ver carrinho ({cartCount})
          </Link>
        </div>
      ) : null}
    </main>
  );
}
