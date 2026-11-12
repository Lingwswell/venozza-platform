import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { PromotionInputError, parsePromotionInput } from "@/lib/promotions/admin-input";
import { checkPromotionProduct, promotionAdminSelect, promotionStatus } from "@/lib/promotions/admin";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function findOwned(id: string, tenantId: string) {
  return prisma.promotion.findFirst({ where: { id, tenantId }, select: { id: true } });
}

// Editar promocao. Corpo so com { active } liga/desliga sem revalidar o resto.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return fail("Só o dono da rede edita promoções.", 403);
    if (!(await findOwned(id, scope.tenantId))) return fail("Promoção não encontrada", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const onlyToggle = Object.keys(body).length === 1 && "active" in body;
    const data = onlyToggle ? { active: body.active !== false } : parsePromotionInput(body, scope.storeIds);
    if (!onlyToggle) await checkPromotionProduct(scope, data as ReturnType<typeof parsePromotionInput>);

    const promotion = await prisma.promotion.update({
      where: { id },
      data,
      select: promotionAdminSelect,
    });

    return NextResponse.json({ ok: true, promotion: { ...promotion, status: promotionStatus(promotion) } });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof PromotionInputError) return fail((error as Error).message, 400);
    console.error("[api/admin/promotions/:id][PATCH]", error);
    return fail("Erro ao salvar promoção", 500);
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return fail("Só o dono da rede apaga promoções.", 403);
    if (!(await findOwned(id, scope.tenantId))) return fail("Promoção não encontrada", 404);

    await prisma.promotion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/promotions/:id][DELETE]", error);
    return fail("Erro ao apagar promoção", 500);
  }
}
