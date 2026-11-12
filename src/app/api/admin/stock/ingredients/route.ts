import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { StockInputError, stockFail } from "@/lib/stock/access";
import { isUniqueViolation, parseIngredientInput } from "@/lib/stock/ingredient-input";

const select = {
  id: true,
  name: true,
  unit: true,
  minStore: true,
  reorderQuantity: true,
  active: true,
  _count: { select: { recipeItems: true } },
} as const;

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.viewStock(scope.role)) return stockFail("Sem acesso ao estoque.", 403);

    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId: scope.tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select,
    });
    return NextResponse.json({ ok: true, ingredients, canEdit: can.manageCatalog(scope.role) });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/ingredients][GET]", error);
    return stockFail("Erro ao carregar os insumos.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return stockFail("Só o dono da rede cadastra insumos.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = parseIngredientInput(body);
    const ingredient = await prisma.ingredient.create({
      data: { ...data, tenantId: scope.tenantId },
      select,
    });
    return NextResponse.json({ ok: true, ingredient }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    if (isUniqueViolation(error)) return stockFail("Já existe um insumo com esse nome.", 409);
    console.error("[api/admin/stock/ingredients][POST]", error);
    return stockFail("Erro ao cadastrar o insumo.", 500);
  }
}
