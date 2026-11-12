import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { PROMO_COLORS, PromotionInputError, parsePromotionInput } from "@/lib/promotions/admin-input";
import { checkPromotionProduct, promotionAdminSelect, promotionStatus } from "@/lib/promotions/admin";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Lista de promocoes da rede + dados do formulario (produtos, lojas, cores).
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return fail("Só o dono da rede gerencia promoções.", 403);

    const [promotions, products, stores] = await Promise.all([
      prisma.promotion.findMany({
        where: { tenantId: scope.tenantId },
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        select: promotionAdminSelect,
      }),
      prisma.product.findMany({
        where: { OR: [{ tenantId: scope.tenantId }, { storeId: { in: scope.storeIds } }] },
        orderBy: { name: "asc" },
        select: { id: true, name: true, price_cents: true },
      }),
      prisma.store.findMany({
        where: { tenantId: scope.tenantId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      colors: PROMO_COLORS,
      products,
      stores,
      promotions: promotions.map((p) => ({ ...p, status: promotionStatus(p) })),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/promotions][GET]", error);
    return fail("Erro ao listar promoções", 500);
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return fail("Só o dono da rede cria promoções.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = parsePromotionInput(body, scope.storeIds);
    await checkPromotionProduct(scope, data);

    const promotion = await prisma.promotion.create({
      data: { ...data, tenantId: scope.tenantId },
      select: promotionAdminSelect,
    });

    return NextResponse.json(
      { ok: true, promotion: { ...promotion, status: promotionStatus(promotion) } },
      { status: 201 }
    );
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof PromotionInputError) return fail((error as Error).message, 400);
    console.error("[api/admin/promotions][POST]", error);
    return fail("Erro ao criar promoção", 500);
  }
}
