"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart-storage";
import { formatMoneyFromCents } from "@/lib/utils/formatters";
import {
  pizzaBorderOptions as borderOptions,
  pizzaDoughOptions as doughOptions,
  pizzaExtraDrinkOptions as drinkOptions,
  pizzaSizeOptions,
  type CustomizationOptionItem as OptionItem,
} from "@/lib/product-customizations";
import {
  getMobileStoreContext,
  getMobileStoreHeaders,
} from "@/lib/mobile-store-context";

type Product = {
  id: string | number;
  name: string;
  description?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  price?: number;
  price_cents?: number;
  priceCents?: number;
  category?: string | null;
  active?: boolean;
  available?: boolean;
  storeId?: string | null;
};

const SIZE_40_EXTRA_CENTS =
  pizzaSizeOptions.find((option) => option.id === "40cm")?.price_delta_cents || 0;

function getProductPriceCents(product: Product): number {
  if (typeof product.price_cents === "number") return product.price_cents;
  if (typeof product.priceCents === "number") return product.priceCents;
  if (typeof product.price === "number") return Math.round(product.price * 100);
  return 0;
}

function getProductImage(product: Product) {
  return product.imageUrl || product.image || "";
}

function getProductsFromResponse(data: any): Product[] {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function isPizzaProduct(product: Product) {
  const text = [
    product.category,
    product.name,
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("pizza") ||
    text.includes("pizzas") ||
    text.includes("calabresa") ||
    text.includes("margherita") ||
    text.includes("marguerita") ||
    text.includes("pepperoni")
  );
}

function OptionRow({
  option,
  selected,
  onClick,
}: {
  option: OptionItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
        selected ? "border-[#ff1010] bg-[#fff1f1]" : "border-[#eadfda] bg-white",
      ].join(" ")}
    >
      <span className="text-sm font-black text-[#171717]">{option.name}</span>

      <span className="text-xs font-black text-[#ff1010]">
        {option.price_cents > 0 ? `+ ${formatMoneyFromCents(option.price_cents)}` : "Grátis"}
      </span>
    </button>
  );
}

function CounterRow({
  option,
  quantity,
  onIncrement,
  onDecrement,
}: {
  option: OptionItem;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#eadfda] bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-black text-[#171717]">{option.name}</p>
        <p className="mt-1 text-xs font-bold text-[#ff1010]">
          + {formatMoneyFromCents(option.price_cents)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfda] bg-white text-lg font-black"
        >
          -
        </button>

        <span className="min-w-5 text-center text-sm font-black">{quantity}</span>

        <button
          type="button"
          onClick={onIncrement}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff1010] text-lg font-black text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function MeioAMeioPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<string[]>([]);
  const [selectedBorderId, setSelectedBorderId] = useState("sem-borda");
  const [selectedDoughId, setSelectedDoughId] = useState("massa-tradicional");
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedFlavors = useMemo(() => {
    return selectedFlavorIds
      .map((id) => products.find((product) => String(product.id) === id))
      .filter(Boolean) as Product[];
  }, [products, selectedFlavorIds]);

  const selectedBorder = useMemo(() => {
    return borderOptions.find((item) => item.id === selectedBorderId) || borderOptions[0];
  }, [selectedBorderId]);

  const selectedDough = useMemo(() => {
    return doughOptions.find((item) => item.id === selectedDoughId) || doughOptions[0];
  }, [selectedDoughId]);

  const selectedDrinks = useMemo(() => {
    return drinkOptions
      .map((drink) => ({
        ...drink,
        quantity: Number(drinkQuantities[drink.id] || 0),
      }))
      .filter((drink) => drink.quantity > 0);
  }, [drinkQuantities]);

  const pizzaBaseCents = useMemo(() => {
    if (selectedFlavors.length === 0) return 0;

    return Math.max(
      ...selectedFlavors.map((flavor) => getProductPriceCents(flavor))
    );
  }, [selectedFlavors]);

  const unitTotalCents = useMemo(() => {
    const drinksTotal = selectedDrinks.reduce((sum, drink) => {
      return sum + drink.price_cents * drink.quantity;
    }, 0);

    return (
      pizzaBaseCents +
      SIZE_40_EXTRA_CENTS +
      selectedBorder.price_cents +
      selectedDough.price_cents +
      drinksTotal
    );
  }, [pizzaBaseCents, selectedBorder, selectedDough, selectedDrinks]);

  const finalTotalCents = unitTotalCents * quantity;

  useEffect(() => {
    let alive = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/products", {
          cache: "no-store",
          headers: getMobileStoreHeaders(),
        });

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || "Erro ao carregar sabores.");
        }

        const list = getProductsFromResponse(data).filter(
          (product) =>
            product.active !== false &&
            product.available !== false &&
            isPizzaProduct(product)
        );

        if (alive) {
          setProducts(list);
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "Erro ao carregar sabores.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      alive = false;
    };
  }, []);

  function toggleFlavor(flavorId: string) {
    setMessage("");

    setSelectedFlavorIds((current) => {
      if (current.includes(flavorId)) {
        return current.filter((id) => id !== flavorId);
      }

      if (current.length >= 2) {
        return [current[1], flavorId];
      }

      return [...current, flavorId];
    });
  }

  function getFlavorQuantity(flavorId: string) {
    return selectedFlavorIds.includes(flavorId) ? 1 : 0;
  }

  function updateDrinkQuantity(id: string, nextQuantity: number) {
    setDrinkQuantities((current) => ({
      ...current,
      [id]: Math.max(0, nextQuantity),
    }));
  }

  function handleAddToCart() {
    if (selectedFlavors.length !== 2) {
      setMessage("Escolha 2 sabores para montar a pizza meio a meio.");
      return;
    }

    const mobileStore = getMobileStoreContext();
    const flavorNames = selectedFlavors.map((flavor) => flavor.name);
    const firstImage = getProductImage(selectedFlavors[0]);

    const addons = [
      `Meio a meio: ${flavorNames.join(" / ")}`,
      "Tamanho: Pizza Família - 40cm",
      `Borda: ${selectedBorder.name}`,
      `Massa: ${selectedDough.name}`,
      ...selectedDrinks.map((drink) => `${drink.quantity}x ${drink.name}`),
    ];

    addToCart({
      id: `half-half-${selectedFlavorIds.join("-")}`,
      name: "Pizza Meio a Meio 40cm",
      price_cents: unitTotalCents,
      quantity,
      image: firstImage,
      note,
      addons,
      crust: selectedBorder.name,
      size: "Pizza Família - 40cm",
      tenantId: mobileStore.tenantId,
      storeId: mobileStore.storeId,
    });

    router.push("/m/carrinho");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f1ef] px-4 py-6 text-[#171717]">
        <p className="text-sm font-bold text-[#777]">Carregando sabores...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f1ef] px-4 py-6 text-[#171717]">
        <Link
          href="/m"
          className="mb-6 inline-flex rounded-full border border-[#eadfda] bg-white px-4 py-2 text-sm font-black text-[#555]"
        >
          Voltar
        </Link>

        <h1 className="text-xl font-black">Não foi possível carregar</h1>
        <p className="mt-2 text-sm text-[#777]">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f1ef] pb-32 text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <Link
          href="/m"
          className="mb-4 inline-flex rounded-full border border-[#eadfda] bg-white px-4 py-2 text-sm font-black text-[#555] shadow-sm"
        >
          Voltar
        </Link>

        <section className="overflow-hidden rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <div className="flex h-44 w-full items-center justify-center rounded-[22px] bg-[#fff1f1] text-6xl">
            🍕
          </div>

          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#ff1010]">
            Pizza 40cm
          </p>

          <h1 className="mt-2 text-2xl font-black">Pizza Meio a Meio</h1>

          <p className="mt-2 text-sm leading-6 text-[#666]">
            Escolha 2 sabores para montar sua pizza família de 40cm.
          </p>

          <div className="mt-4 rounded-2xl bg-[#fff7f5] p-4">
            <p className="text-xs font-bold text-[#777]">
              Preço base usa o maior valor entre os sabores
            </p>
            <p className="mt-1 text-2xl font-black text-[#ff1010]">
              {selectedFlavors.length > 0
                ? formatMoneyFromCents(pizzaBaseCents + SIZE_40_EXTRA_CENTS)
                : "Escolha os sabores"}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-black">Sabores da pizza</h2>
            <p className="mt-1 text-xs font-semibold text-[#777]">
              Obrigatório escolher 2 sabores.
            </p>
          </div>

          <div className="mb-3 rounded-2xl bg-[#fff7f5] px-4 py-3 text-xs font-bold text-[#777]">
            Sabores selecionados:{" "}
            <span className="text-[#ff1010]">{selectedFlavorIds.length}/2</span>
          </div>

          <div className="space-y-3">
            {products.map((product) => {
              const flavorId = String(product.id);
              const selected = selectedFlavorIds.includes(flavorId);
              const qty = getFlavorQuantity(flavorId);

              return (
                <div
                  key={flavorId}
                  className={[
                    "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                    selected ? "border-[#ff1010] bg-[#fff1f1]" : "border-[#eadfda] bg-white",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => toggleFlavor(flavorId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-black text-[#171717]">{product.name}</p>
                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#777]">
                        {product.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs font-black text-[#ff1010]">
                      + {formatMoneyFromCents(getProductPriceCents(product) + SIZE_40_EXTRA_CENTS)}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selected) toggleFlavor(flavorId);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfda] bg-white text-lg font-black"
                    >
                      -
                    </button>

                    <span className="min-w-5 text-center text-sm font-black">{qty}</span>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selected) toggleFlavor(flavorId);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff1010] text-lg font-black text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Bordas</h2>

          <div className="space-y-3">
            {borderOptions.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                selected={selectedBorderId === option.id}
                onClick={() => setSelectedBorderId(option.id)}
              />
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Massa da pizza</h2>

          <div className="space-y-3">
            {doughOptions.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                selected={selectedDoughId === option.id}
                onClick={() => setSelectedDoughId(option.id)}
              />
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-black">Bebidas</h2>

          <div className="space-y-3">
            {drinkOptions.map((option) => (
              <CounterRow
                key={option.id}
                option={option}
                quantity={Number(drinkQuantities[option.id] || 0)}
                onIncrement={() =>
                  updateDrinkQuantity(option.id, Number(drinkQuantities[option.id] || 0) + 1)
                }
                onDecrement={() =>
                  updateDrinkQuantity(option.id, Number(drinkQuantities[option.id] || 0) - 1)
                }
              />
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Alguma observação?</h2>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex: sem cebola, pouco molho, cortar em mais fatias..."
            className="mt-3 min-h-28 w-full rounded-2xl border border-[#eadfda] px-4 py-3 text-sm outline-none"
          />
        </section>

        {message ? (
          <p className="mt-5 rounded-2xl bg-[#fff1f1] px-4 py-3 text-sm font-bold text-[#d91c1c]">
            {message}
          </p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#eadfda] bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <div className="flex items-center rounded-full border border-[#eadfda] bg-white px-2 py-1">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-black text-[#555]"
            >
              -
            </button>

            <span className="min-w-8 text-center text-sm font-black">{quantity}</span>

            <button
              type="button"
              onClick={() => setQuantity((current) => current + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-black text-[#555]"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="flex h-14 flex-1 items-center justify-center rounded-full bg-[#ff1010] px-5 text-sm font-black text-white shadow-sm"
          >
            Adicionar {formatMoneyFromCents(finalTotalCents)}
          </button>
        </div>
      </div>
    </main>
  );
}
