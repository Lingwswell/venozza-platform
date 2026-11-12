import { StockInputError, optionalNumber } from "@/lib/stock/access";

export const INGREDIENT_UNITS = ["g", "ml", "un"] as const;

/** Valida o cadastro de insumo (quantidades na unidade base). */
export function parseIngredientInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) throw new StockInputError("Informe o nome do insumo.");

  const unit = String(body.unit ?? "g");
  if (!(INGREDIENT_UNITS as readonly string[]).includes(unit)) {
    throw new StockInputError("Unidade inválida.");
  }

  return {
    name,
    unit,
    minStore: optionalNumber(body.minStore, "Mínimo nas lojas"),
    reorderQuantity: optionalNumber(body.reorderQuantity, "Quantidade de reposição"),
    active: body.active !== false,
  };
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
