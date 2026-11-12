import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { RECIPE_GROUP_SLUGS, optionGroupKind } from "@/lib/stock/server";
import { StockInputError, optionalNumber, positiveNumber, stockFail } from "@/lib/stock/access";

// Ficha tecnica: produtos, opcoes (tamanho, borda, massa, bebidas, recheio) e os insumos de cada um.

const lineSelect = { id: true, ingredientId: true, quantity: true } as const;

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return stockFail("Só o dono da rede mexe na ficha técnica.", 403);

    const [products, groups, ingredients] = await Promise.all([
      prisma.product.findMany({
        where: { OR: [{ tenantId: scope.tenantId }, { storeId: { in: scope.storeIds } }] },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: { id: true, name: true, category: true, recipeItems: { select: lineSelect } },
      }),
      prisma.optionGroup.findMany({
        where: { tenantId: scope.tenantId, slug: { in: RECIPE_GROUP_SLUGS } },
        orderBy: { sortOrder: "asc" },
        select: {
          slug: true,
          name: true,
          items: {
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, stockFactor: true, recipeItems: { select: lineSelect } },
          },
        },
      }),
      prisma.ingredient.findMany({
        where: { tenantId: scope.tenantId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, unit: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      products,
      groups: groups.map((g) => ({ ...g, kind: optionGroupKind(g.slug) })),
      ingredients,
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/recipes][GET]", error);
    return stockFail("Erro ao carregar a ficha técnica.", 500);
  }
}

// Troca a ficha inteira de um produto ou de uma opcao.
export async function PUT(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return stockFail("Só o dono da rede mexe na ficha técnica.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const productId = body.productId ? String(body.productId) : null;
    const optionItemId = body.optionItemId ? String(body.optionItemId) : null;
    if (!productId === !optionItemId) throw new StockInputError("Escolha um produto ou uma opção.");

    if (productId) {
      const ok = await prisma.product.findFirst({
        where: { id: productId, OR: [{ tenantId: scope.tenantId }, { storeId: { in: scope.storeIds } }] },
        select: { id: true },
      });
      if (!ok) return stockFail("Produto não encontrado.", 404);
    } else {
      const ok = await prisma.optionItem.findFirst({
        where: { id: optionItemId!, tenantId: scope.tenantId },
        select: { id: true },
      });
      if (!ok) return stockFail("Opção não encontrada.", 404);
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length > 40) throw new StockInputError("Ficha com itens demais.");

    const merged = new Map<string, number>();
    for (const raw of rawLines as Record<string, unknown>[]) {
      const ingredientId = String(raw?.ingredientId || "");
      if (!ingredientId) continue;
      const quantity = positiveNumber(raw.quantity, "Quantidade da ficha");
      merged.set(ingredientId, (merged.get(ingredientId) || 0) + quantity);
    }

    if (merged.size > 0) {
      const valid = await prisma.ingredient.count({
        where: { id: { in: Array.from(merged.keys()) }, tenantId: scope.tenantId },
      });
      if (valid !== merged.size) throw new StockInputError("Insumo inválido na ficha.");
    }

    const where = productId ? { productId } : { optionItemId: optionItemId! };
    await prisma.$transaction([
      prisma.recipeItem.deleteMany({ where: { ...where, tenantId: scope.tenantId } }),
      prisma.recipeItem.createMany({
        data: Array.from(merged.entries()).map(([ingredientId, quantity]) => ({
          tenantId: scope.tenantId,
          ingredientId,
          quantity,
          productId,
          optionItemId,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock/recipes][PUT]", error);
    return stockFail("Erro ao salvar a ficha técnica.", 500);
  }
}

// Proporcao de um tamanho (ex.: broto 0,5). Vazio = 1.
export async function PATCH(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageCatalog(scope.role)) return stockFail("Só o dono da rede mexe na ficha técnica.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const item = await prisma.optionItem.findFirst({
      where: {
        id: String(body.optionItemId || ""),
        tenantId: scope.tenantId,
        optionGroup: { slug: { in: ["pizza-tamanho", "batata-tamanho"] } },
      },
      select: { id: true },
    });
    if (!item) return stockFail("Tamanho não encontrado.", 404);

    const factor = optionalNumber(body.stockFactor, "Proporção");
    if (factor !== null && (factor <= 0 || factor > 10)) {
      throw new StockInputError("Proporção deve ficar entre 0,1 e 10.");
    }

    await prisma.optionItem.update({ where: { id: item.id }, data: { stockFactor: factor } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock/recipes][PATCH]", error);
    return stockFail("Erro ao salvar a proporção.", 500);
  }
}
