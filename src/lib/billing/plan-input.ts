import { slugifyTenant } from "@/lib/billing/server";

export class PlanInputError extends Error {}

export function parsePlanInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim().slice(0, 40);
  if (!name) throw new PlanInputError("Informe o nome do plano.");
  const priceCents = Math.round(Number(body.priceCents));
  if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 10_000_000) {
    throw new PlanInputError("Valor por loja inválido.");
  }
  const trialDays = Math.round(Number(body.trialDays ?? 14));
  if (!Number.isFinite(trialDays) || trialDays < 0 || trialDays > 365) throw new PlanInputError("Dias de teste inválidos.");
  const maxRaw = body.maxStores;
  const maxStores = maxRaw === null || maxRaw === undefined || maxRaw === "" ? null : Math.round(Number(maxRaw));
  if (maxStores !== null && (!Number.isFinite(maxStores) || maxStores < 1)) throw new PlanInputError("Limite de lojas inválido.");
  const extraRaw = body.extraStorePriceCents;
  const extraStorePriceCents =
    extraRaw === null || extraRaw === undefined || extraRaw === "" ? null : Math.round(Number(extraRaw));
  if (extraStorePriceCents !== null && (!Number.isFinite(extraStorePriceCents) || extraStorePriceCents < 0)) {
    throw new PlanInputError("Preço da loja extra inválido.");
  }
  return {
    name,
    extraStorePriceCents,
    slug: slugifyTenant(String(body.slug || name)) || "plano",
    description: String(body.description ?? "").trim().slice(0, 160) || null,
    priceCents,
    trialDays,
    maxStores,
    active: body.active !== false,
    sortOrder: Math.round(Number(body.sortOrder) || 0),
  };
}
