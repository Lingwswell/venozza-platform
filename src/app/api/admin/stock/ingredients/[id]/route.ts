import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { StockInputError, stockFail } from "@/lib/stock/access";
import { isUniqueViolation, parseIngredientInput } from "@/lib/stock/ingredient-input";

// Editar insumo. A unidade so muda enquanto o insumo nao tem movimento
// (senao os saldos antigos ficariam na unidade errada).
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return stockFail("Só o dono da rede edita insumos.", 403);

    const current = await prisma.ingredient.findFirst({
      where: { id, tenantId: scope.tenantId },
      select: { id: true, unit: true, _count: { select: { movements: true } } },
    });
    if (!current) return stockFail("Insumo não encontrado.", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = parseIngredientInput(body);
    if (data.unit !== current.unit && current._count.movements > 0) {
      throw new StockInputError("Este insumo já tem movimentos: a unidade não pode mudar. Crie um insumo novo.");
    }

    await prisma.ingredient.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    if (isUniqueViolation(error)) return stockFail("Já existe um insumo com esse nome.", 409);
    console.error("[api/admin/stock/ingredients/:id][PATCH]", error);
    return stockFail("Erro ao salvar o insumo.", 500);
  }
}
