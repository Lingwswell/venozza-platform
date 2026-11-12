import { prisma } from "@/lib/db";
import type { AdminScope } from "@/lib/auth/scope";
import { PromotionInputError, type PromotionData } from "@/lib/promotions/admin-input";

export const promotionAdminSelect = {
  id: true,
  title: true,
  message: true,
  kind: true,
  productId: true,
  discountType: true,
  discountValue: true,
  color: true,
  emoji: true,
  storeIds: true,
  startsAt: true,
  endsAt: true,
  active: true,
  createdAt: true,
  product: { select: { id: true, name: true, price_cents: true, image: true } },
} as const;

/** Produto precisa ser da rede; desconto "por R$ X" precisa ser menor que o preco normal. */
export async function checkPromotionProduct(scope: AdminScope, data: PromotionData) {
  if (!data.productId) return;

  const product = await prisma.product.findFirst({
    where: {
      id: data.productId,
      OR: [{ tenantId: scope.tenantId }, { storeId: { in: scope.storeIds } }],
    },
    select: { price_cents: true, name: true },
  });

  if (!product) throw new PromotionInputError("Produto não encontrado nesta rede.");

  if (
    data.kind === "discount" &&
    data.discountType === "fixed_price" &&
    data.discountValue !== null &&
    data.discountValue >= product.price_cents
  ) {
    throw new PromotionInputError(
      `O preço promocional precisa ser menor que o preço normal de ${product.name}.`
    );
  }
}

export function promotionStatus(p: { active: boolean; startsAt: Date | null; endsAt: Date | null }) {
  const now = Date.now();
  if (!p.active) return "off";
  if (p.endsAt && p.endsAt.getTime() <= now) return "ended";
  if (p.startsAt && p.startsAt.getTime() > now) return "scheduled";
  return "live";
}
