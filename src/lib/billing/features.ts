import { prisma } from "@/lib/db";

// Recurso vendido como adicional so aparece para quem contratou.
// Regras (para nao tirar nada de quem ja usa):
// - rede sem plano (como a primeira rede da plataforma): tem tudo;
// - recurso que nenhum adicional ativo vende: todo mundo tem;
// - senao: so quem contratou o adicional.

const cache = new Map<string, { at: number; features: Record<string, boolean> }>();

export async function tenantFeatures(tenantId: string): Promise<Record<string, boolean>> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < 60_000) return hit.features;

  const [tenant, addons] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true, addons: { select: { addonId: true } } },
    }),
    prisma.addon.findMany({ where: { active: true, feature: { not: null } }, select: { id: true, feature: true } }),
  ]);

  const owned = new Set((tenant?.addons || []).map((a) => a.addonId));
  const features: Record<string, boolean> = {};
  for (const addon of addons) {
    const key = addon.feature as string;
    const has = !tenant?.planId || owned.has(addon.id);
    features[key] = Boolean(features[key] || has);
  }

  cache.set(tenantId, { at: Date.now(), features });
  return features;
}

/** true = pode usar. Recurso que nao e vendido a parte e sempre liberado. */
export async function tenantHasFeature(tenantId: string, feature: string) {
  try {
    const features = await tenantFeatures(tenantId);
    return features[feature] !== false;
  } catch (error) {
    console.error("[billing][tenantHasFeature]", error);
    return true;
  }
}

export function forgetFeatures(tenantId?: string) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}
