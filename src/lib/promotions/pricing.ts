// Regra de preco das promocoes. Usada pelo servidor (cobranca do pedido) e pelas
// APIs de catalogo (o que o cliente ve), para os dois nunca divergirem.
// Arquivo sem dependencias de servidor.

export type PromotionKind = "notice" | "discount";
export type DiscountType = "percent" | "fixed_price";

export type PromotionRule = {
  id: string;
  title: string;
  kind: string;
  productId: string | null;
  discountType: string | null;
  discountValue: number | null;
  storeIds: string[];
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  active: boolean;
};

/** Promocao esta valendo agora nesta loja? */
export function isPromotionLive(promo: PromotionRule, storeId: string, now: Date = new Date()) {
  if (!promo.active) return false;
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now.getTime()) return false;
  if (promo.endsAt && new Date(promo.endsAt).getTime() <= now.getTime()) return false;
  if (promo.storeIds.length > 0 && !promo.storeIds.includes(storeId)) return false;
  return true;
}

/**
 * Preco base com a promocao. O desconto vale so sobre o preco base do produto;
 * tamanho, borda, massa e bebidas continuam com o preco normal.
 * Nunca aumenta o preco e nunca deixa abaixo de R$ 0,01.
 */
export function promoBasePrice(baseCents: number, promo: PromotionRule): number {
  if (promo.kind !== "discount" || typeof promo.discountValue !== "number") return baseCents;

  let price = baseCents;
  if (promo.discountType === "percent") {
    const pct = Math.min(90, Math.max(1, Math.round(promo.discountValue)));
    price = Math.round((baseCents * (100 - pct)) / 100);
  } else if (promo.discountType === "fixed_price") {
    price = Math.round(promo.discountValue);
  }

  return Math.max(1, Math.min(baseCents, price));
}

/** Melhor (menor) preco entre as promocoes de desconto valendo para o produto. */
export function bestPromoPrice(
  productId: string,
  baseCents: number,
  promos: PromotionRule[]
): { priceCents: number; promo: PromotionRule | null } {
  let best = { priceCents: baseCents, promo: null as PromotionRule | null };
  for (const promo of promos) {
    if (promo.kind !== "discount" || promo.productId !== productId) continue;
    const price = promoBasePrice(baseCents, promo);
    if (price < best.priceCents) best = { priceCents: price, promo };
  }
  return best;
}

export function describeDiscount(promo: { discountType: string | null; discountValue: number | null }) {
  if (promo.discountType === "percent" && promo.discountValue) return `${promo.discountValue}% off`;
  if (promo.discountType === "fixed_price" && promo.discountValue) {
    return `por ${(promo.discountValue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  }
  return "";
}
