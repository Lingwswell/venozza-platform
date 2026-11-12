import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { CENTRAL, checkLowStock, moveStock } from "@/lib/stock/server";
import { StockInputError, assertLocation, optionalNumber, stockFail } from "@/lib/stock/access";

// Contagem de estoque: informa o que tem de verdade em varios insumos de uma vez.
// A diferenca para o que o sistema esperava fica registrada como "contagem".
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const location = String(body.location || "");
    assertLocation(scope, location, true);

    const raw = Array.isArray(body.counts) ? (body.counts as Record<string, unknown>[]) : [];
    const counts = new Map<string, number>();
    for (const c of raw) {
      const id = String(c?.ingredientId || "");
      const q = optionalNumber(c?.quantity, "Quantidade contada");
      if (id && q !== null) counts.set(id, q);
    }
    if (counts.size === 0) throw new StockInputError("Informe pelo menos uma quantidade contada.");
    if (counts.size > 500) throw new StockInputError("Contagem grande demais.");

    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: Array.from(counts.keys()) }, tenantId: scope.tenantId },
      select: {
        id: true,
        name: true,
        unit: true,
        costCents: true,
        stockLevels: { where: { location }, select: { quantity: true } },
      },
    });
    if (ingredients.length !== counts.size) throw new StockInputError("Insumo inválido na contagem.");

    const note = String(body.note || "").trim().slice(0, 120) || "Contagem";
    const differences: { ingredientId: string; name: string; unit: string; expected: number; counted: number; diff: number; costCents: number | null }[] = [];

    for (const ing of ingredients) {
      const expected = ing.stockLevels[0]?.quantity ?? 0;
      const counted = counts.get(ing.id)!;
      const diff = Math.round((counted - expected) * 1000) / 1000;
      differences.push({ ingredientId: ing.id, name: ing.name, unit: ing.unit, expected, counted, diff, costCents: ing.costCents });
      if (diff !== 0) {
        await moveStock({
          tenantId: scope.tenantId,
          ingredientId: ing.id,
          location,
          delta: diff,
          type: "contagem",
          note,
          userId: scope.userId,
        });
      }
    }

    if (location !== CENTRAL) {
      await checkLowStock(
        scope.tenantId,
        location,
        differences.filter((d) => d.diff < 0).map((d) => d.ingredientId)
      );
    }

    return NextResponse.json({ ok: true, differences });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock/count][POST]", error);
    return stockFail("Erro ao salvar a contagem.", 500);
  }
}
