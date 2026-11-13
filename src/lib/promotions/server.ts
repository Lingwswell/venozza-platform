import { prisma } from "@/lib/db";
import { isPromotionLive, type PromotionRule } from "@/lib/promotions/pricing";
import { tenantHasFeature } from "@/lib/billing/features";

const promotionRuleSelect = {
  id: true,
  title: true,
  kind: true,
  productId: true,
  discountType: true,
  discountValue: true,
  storeIds: true,
  startsAt: true,
  endsAt: true,
  active: true,
} as const;

/** Promocoes valendo agora na loja (aviso e desconto). */
export async function loadLivePromotions(storeId: string, tenantId?: string): Promise<PromotionRule[]> {
  let tenant: string;
  if (tenantId) {
    tenant = tenantId;
  } else {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
    if (!store) return [];
    tenant = store.tenantId;
  }

  // Promocoes vendidas como adicional: sem contratar, nao valem (nem balao, nem desconto).
  if (!(await tenantHasFeature(tenant, "promocoes"))) return [];

  const now = new Date();
  const rows = await prisma.promotion.findMany({
    where: {
      tenantId: tenant,
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    select: promotionRuleSelect,
  });

  return rows.filter((row) => isPromotionLive(row, storeId, now));
}
