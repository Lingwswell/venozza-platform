import { slugifyTenant } from "@/lib/billing/server";
import { FEATURES } from "@/lib/billing/state";

export class AddonInputError extends Error {}

export function parseAddonInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) throw new AddonInputError("Informe o nome do adicional.");
  const priceCents = Math.round(Number(body.priceCents));
  if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 10_000_000) {
    throw new AddonInputError("Valor mensal inválido.");
  }
  const feature = body.feature ? String(body.feature) : null;
  if (feature && !(feature in FEATURES)) throw new AddonInputError("Recurso inválido.");
  return {
    name,
    slug: slugifyTenant(name) || "adicional",
    description: String(body.description ?? "").trim().slice(0, 160) || null,
    priceCents,
    feature,
    active: body.active !== false,
    sortOrder: Math.round(Number(body.sortOrder) || 0),
  };
}
