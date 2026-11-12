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
    costCents: optionalCents(body.costCents),
    active: body.active !== false,
  };
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Custo em centavos (por kg, L ou unidade); vazio = sem custo. */
function optionalCents(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new StockInputError("Custo inválido.");
  return Math.round(n);
}
