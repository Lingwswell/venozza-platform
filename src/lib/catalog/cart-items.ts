// Montagem dos itens do carrinho no MESMO formato que o app usa (tela do produto e
// meio a meio). O servidor recalcula o preco a partir destes campos (tamanho, borda,
// massa, bebidas), entao site e app precisam mandar exatamente a mesma coisa.

import type { CartItem } from "@/types/order";
import type { CatalogOption } from "@/lib/use-option-catalog";

export type ProductKind = "pizza" | "batata" | "bebida" | "simples";

type KindInput = { name: string; category?: string | null; customizationType?: string | null };

/** Mesma regra da tela do produto no app. */
export function detectProductKind(product: KindInput): ProductKind {
  const name = String(product.name || "").toLowerCase();
  const category = String(product.category || "").toLowerCase();
  const type = String(product.customizationType || "auto").toLowerCase();

  const inferredDrink =
    category.includes("bebida") ||
    ["coca", "guarana", "guaraná", "pepsi", "fanta", "sprite", "refrigerante", "suco", "agua", "água"].some(
      (word) => name.includes(word)
    );

  const inferredBatata =
    !inferredDrink &&
    (name.includes("batata") ||
      name.includes("batatinha") ||
      category.includes("acompanhamento") ||
      category.includes("porcao") ||
      category.includes("porção"));

  const inferredPizza = !inferredDrink && category.includes("pizza") && !inferredBatata;

  if (type === "bebida" || type === "simples" || (type === "auto" && inferredDrink)) return "bebida";
  if (type === "batata" || (type === "auto" && inferredBatata)) return "batata";
  if (type === "pizza" || (type === "auto" && inferredPizza)) return "pizza";
  return "simples";
}

type Store = { tenantId: string; storeId: string };
type DrinkPick = CatalogOption & { quantity: number };

export function drinksTotalCents(drinks: DrinkPick[]) {
  return drinks.reduce((sum, d) => sum + d.price_cents * d.quantity, 0);
}

/** Preco unitario de uma pizza de 1 sabor (igual ao app). */
export function pizzaUnitCents(input: {
  basePriceCents: number;
  size: CatalogOption;
  border: CatalogOption;
  dough: CatalogOption;
  drinks: DrinkPick[];
}) {
  return Math.max(
    0,
    input.basePriceCents +
      Number(input.size.price_cents || 0) +
      Number(input.border.price_cents || 0) +
      Number(input.dough.price_cents || 0) +
      drinksTotalCents(input.drinks)
  );
}

/** Preco unitario da batata (igual ao app). */
export function batataUnitCents(input: {
  basePriceCents: number;
  potatoSize: CatalogOption;
  filling: CatalogOption;
}) {
  return Math.max(
    0,
    input.basePriceCents + Number(input.potatoSize.price_cents || 0) + Number(input.filling.price_cents || 0)
  );
}

export function buildPizzaItem(input: {
  product: { id: string; name: string; image: string | null };
  size: CatalogOption;
  border: CatalogOption;
  dough: CatalogOption;
  drinks: DrinkPick[];
  unitCents: number;
  quantity: number;
  note: string;
  store: Store;
}): CartItem {
  return {
    id: String(input.product.id),
    name: input.product.name,
    price_cents: input.unitCents,
    quantity: input.quantity,
    image: input.product.image || "",
    note: input.note,
    addons: [
      `Sabor: ${input.product.name}`,
      `Tamanho: ${input.size.name}`,
      `Borda: ${input.border.name}`,
      `Massa: ${input.dough.name}`,
      ...input.drinks.map((d) => `${d.quantity}x ${d.name}`),
    ],
    crust: input.border.name,
    size: input.size.name,
    tenantId: input.store.tenantId,
    storeId: input.store.storeId,
  };
}

export function buildBatataItem(input: {
  product: { id: string; name: string; image: string | null };
  potatoSize: CatalogOption;
  filling: CatalogOption;
  unitCents: number;
  quantity: number;
  note: string;
  store: Store;
}): CartItem {
  return {
    id: String(input.product.id),
    name: input.product.name,
    price_cents: input.unitCents,
    quantity: input.quantity,
    image: input.product.image || "",
    note: input.note,
    addons: [
      `Produto: ${input.product.name}`,
      `Tamanho da batata: ${input.potatoSize.name}`,
      `Recheio: ${input.filling.name}`,
    ],
    crust: input.filling.name,
    size: input.potatoSize.name,
    tenantId: input.store.tenantId,
    storeId: input.store.storeId,
  };
}

/** Pizza meio a meio: preco do sabor mais caro + tamanho familia + borda + massa + bebidas. */
export function halfHalfUnitCents(input: {
  flavorPrices: number[];
  familySize: CatalogOption | null;
  border: CatalogOption;
  dough: CatalogOption;
  drinks: DrinkPick[];
}) {
  if (input.flavorPrices.length === 0) return 0;
  return (
    Math.max(...input.flavorPrices) +
    (input.familySize?.price_cents || 0) +
    input.border.price_cents +
    input.dough.price_cents +
    drinksTotalCents(input.drinks)
  );
}

export function buildHalfHalfItem(input: {
  flavors: { id: string; name: string; image: string | null }[];
  familySize: CatalogOption | null;
  border: CatalogOption;
  dough: CatalogOption;
  drinks: DrinkPick[];
  unitCents: number;
  quantity: number;
  note: string;
  store: Store;
}): CartItem {
  const sizeName = input.familySize?.name || "Pizza Família - 40cm";
  return {
    id: `half-half-${input.flavors.map((f) => f.id).join("-")}`,
    name: "Pizza Meio a Meio 40cm",
    price_cents: input.unitCents,
    quantity: input.quantity,
    image: input.flavors[0]?.image || "",
    note: input.note,
    addons: [
      `Meio a meio: ${input.flavors.map((f) => f.name).join(" / ")}`,
      `Tamanho: ${sizeName}`,
      `Borda: ${input.border.name}`,
      `Massa: ${input.dough.name}`,
      ...input.drinks.map((d) => `${d.quantity}x ${d.name}`),
    ],
    crust: input.border.name,
    size: sizeName,
    tenantId: input.store.tenantId,
    storeId: input.store.storeId,
  };
}
