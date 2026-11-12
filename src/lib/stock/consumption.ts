// Calculo do consumo de insumos de um pedido pela ficha tecnica.
// Arquivo puro (sem banco): usado pelo servidor e testado isoladamente.
//
// Regras:
// - a ficha do produto e multiplicada pela proporcao do tamanho (broto 0.5, grande 1...),
//   menos os insumos contados em unidade (bolinha de massa, caixa), que nao mudam;
// - meio a meio: cada sabor gasta metade da ficha dele;
// - borda, massa, recheio e bebidas tem ficha propria (nao muda com o tamanho);
// - "2x Coca" nas opcoes da pizza gasta 2 vezes a ficha da bebida.

// fixed = nao muda com o tamanho (insumos contados em unidade: bolinha de massa, caixa, lata).
export type RecipeLine = { ingredientId: string; quantity: number; fixed?: boolean };

export type OptionKind = "size" | "border" | "dough" | "drink" | "filling";

export type RecipeOption = {
  id: string;
  name: string;
  kind: OptionKind;
  stockFactor: number | null;
  recipe: RecipeLine[];
};

export type RecipeBook = {
  products: Map<string, RecipeLine[]>;
  options: RecipeOption[];
};

export type ConsumptionItem = {
  productId: string | null;
  flavorIds: string[];
  quantity: number;
  size: string | null;
  crust: string | null;
  addons: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addonValue(addons: string[], label: string): string {
  const wanted = `${normalize(label)}:`;
  const found = addons.find((addon) => normalize(addon).startsWith(wanted));
  return found ? found.slice(found.indexOf(":") + 1).trim() : "";
}

function findOption(book: RecipeBook, kinds: OptionKind[], value: string) {
  const wanted = normalize(value);
  if (!wanted) return undefined;
  return book.options.find((o) => kinds.includes(o.kind) && normalize(o.name) === wanted);
}

/** Le os addons_json gravados no pedido. */
export function parseAddons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function add(
  total: Map<string, number>,
  lines: RecipeLine[] | undefined,
  times: number,
  sizeFactor = 1
) {
  if (!lines || !(times > 0)) return;
  for (const line of lines) {
    if (!(line.quantity > 0)) continue;
    const amount = line.quantity * times * (line.fixed ? 1 : sizeFactor);
    total.set(line.ingredientId, (total.get(line.ingredientId) || 0) + amount);
  }
}

/** Total de cada insumo (na unidade base) que os itens gastam. */
export function computeConsumption(items: ConsumptionItem[], book: RecipeBook): Map<string, number> {
  const total = new Map<string, number>();

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    const addons = item.addons || [];

    const size = findOption(
      book,
      ["size"],
      addonValue(addons, "tamanho") || addonValue(addons, "tamanho da batata") || item.size || ""
    );
    const factor = size?.stockFactor && size.stockFactor > 0 ? size.stockFactor : 1;

    // Produto (ou os dois sabores do meio a meio).
    const flavors = (item.flavorIds || []).filter(Boolean);
    if (flavors.length > 0) {
      for (const flavorId of flavors) {
        add(total, book.products.get(flavorId), qty / flavors.length, factor);
      }
    } else if (item.productId) {
      add(total, book.products.get(item.productId), qty, factor);
    }

    // O tamanho em si pode ter ficha (ex.: caixa de pizza grande).
    if (size) add(total, size.recipe, qty);

    const crust = addonValue(addons, "borda") || item.crust || "";
    const border = findOption(book, ["border"], crust);
    if (border) add(total, border.recipe, qty);

    const dough = findOption(book, ["dough"], addonValue(addons, "massa"));
    if (dough) add(total, dough.recipe, qty);

    const filling =
      findOption(book, ["filling"], addonValue(addons, "recheio")) ||
      (!border ? findOption(book, ["filling"], item.crust || "") : undefined);
    if (filling) add(total, filling.recipe, qty);

    for (const addon of addons) {
      const match = addon.trim().match(/^(\d{1,2})\s*x\s+(.+)$/i);
      if (!match) continue;
      const drink = findOption(book, ["drink"], match[2]);
      if (drink) add(total, drink.recipe, Number(match[1]) * qty);
    }
  }

  // Arredonda para 3 casas (evita 0.30000000004).
  for (const [id, value] of total) total.set(id, Math.round(value * 1000) / 1000);
  return total;
}

/** Abaixo do minimo? (minimo vazio ou zero = sem alerta) */
export function isBelowMin(quantity: number, min: number | null | undefined) {
  return typeof min === "number" && min > 0 && quantity <= min;
}

/** Quanto pedir a central: a reposicao padrao do insumo, ou o suficiente para ficar com 2x o minimo. */
export function suggestedReorder(quantity: number, min: number, reorderQuantity?: number | null) {
  if (typeof reorderQuantity === "number" && reorderQuantity > 0) return reorderQuantity;
  return Math.max(min * 2 - Math.max(quantity, 0), min);
}

/** Exibe 2500 g como "2,5 kg", 750 ml como "750 ml", 3 un como "3 un". */
export function formatQuantity(value: number, unit: string) {
  const n = Number(value) || 0;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  if (unit === "g" && Math.abs(n) >= 1000) return `${fmt(n / 1000)} kg`;
  if (unit === "ml" && Math.abs(n) >= 1000) return `${fmt(n / 1000)} L`;
  return `${fmt(n)} ${unit}`;
}

export const UNIT_LABELS: Record<string, string> = {
  g: "Peso (g / kg)",
  ml: "Volume (ml / L)",
  un: "Unidade",
};
