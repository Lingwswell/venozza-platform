import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTenantFromRequest } from "@/lib/tenant/resolve";
import { loadLivePromotions } from "@/lib/promotions/server";
import { promoBasePrice } from "@/lib/promotions/pricing";

// Promocoes valendo agora numa loja, para os baloes do site e do app.
// O preco mostrado vem da mesma regra que o servidor usa para cobrar o pedido.

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storeId = (url.searchParams.get("storeId") || req.headers.get("x-store-id") || "").trim();
    if (!storeId) return NextResponse.json({ ok: true, promotions: [] });

    const tenant = await resolveTenantFromRequest(req);
    if (!tenant) return NextResponse.json({ ok: true, promotions: [] });

    const store = await prisma.store.findFirst({
      where: { id: storeId, tenantId: tenant.id, active: true },
      select: { id: true, tenantId: true },
    });
    if (!store) return NextResponse.json({ ok: true, promotions: [] });

    const live = await loadLivePromotions(store.id, store.tenantId);
    if (live.length === 0) return NextResponse.json({ ok: true, promotions: [] });

    const [details, links] = await Promise.all([
      prisma.promotion.findMany({
        where: { id: { in: live.map((p) => p.id) } },
        select: {
          id: true,
          message: true,
          color: true,
          emoji: true,
          createdAt: true,
          product: { select: { id: true, name: true, image: true, price_cents: true, available: true, storeId: true } },
        },
      }),
      prisma.productStore.findMany({
        where: {
          storeId: store.id,
          productId: { in: live.map((p) => p.productId).filter((id): id is string => Boolean(id)) },
        },
        select: { productId: true, available: true, stock: true, price_cents: true },
      }),
    ]);

    const detailById = new Map(details.map((d) => [d.id, d]));
    const linkByProduct = new Map(links.map((l) => [l.productId, l]));
    const hasAnyLink = links.length > 0 || (await prisma.productStore.count({ where: { storeId: store.id } })) > 0;

    const promotions = live
      .map((rule) => {
        const detail = detailById.get(rule.id);
        if (!detail) return null;

        let product: { id: string; name: string; image: string | null; priceCents: number; originalPriceCents: number } | null = null;
        const p = detail.product;
        if (p && p.available) {
          const link = linkByProduct.get(p.id);
          // Mesmo criterio do cardapio: produto vendido nesta loja.
          const soldHere = link
            ? link.available && link.stock > 0
            : !hasAnyLink && p.storeId === store.id;
          if (soldHere) {
            const listPrice = link?.price_cents ?? p.price_cents;
            product = {
              id: p.id,
              name: p.name,
              image: p.image,
              originalPriceCents: listPrice,
              priceCents: promoBasePrice(listPrice, rule),
            };
          }
        }

        // Desconto sem o produto disponivel nesta loja nao vira balao.
        if (rule.kind === "discount" && !product) return null;

        return {
          id: rule.id,
          title: rule.title,
          message: detail.message,
          kind: rule.kind,
          color: detail.color,
          emoji: detail.emoji,
          badge:
            rule.kind === "discount" && rule.discountType === "percent" && rule.discountValue
              ? `-${rule.discountValue}%`
              : null,
          product,
          createdAt: detail.createdAt.toISOString(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.createdAt < b!.createdAt ? 1 : -1));

    return NextResponse.json({ ok: true, promotions });
  } catch (error) {
    console.error("[api/promotions][GET]", error);
    return NextResponse.json({ ok: true, promotions: [] });
  }
}
