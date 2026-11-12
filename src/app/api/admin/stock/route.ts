import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { CENTRAL, checkLowStock, effectiveMin, moveStock } from "@/lib/stock/server";
import { isBelowMin } from "@/lib/stock/consumption";
import {
  StockInputError,
  assertLocation,
  optionalNumber,
  positiveNumber,
  stockFail,
  stockLocations,
} from "@/lib/stock/access";

// Estoque de um local (loja ou cozinha central): saldo de cada insumo e o minimo.
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const locations = await stockLocations(scope);
    if (locations.length === 0) return stockFail("Sem acesso ao estoque.", 403);

    const url = new URL(req.url);
    const wanted = url.searchParams.get("location") || "";
    const location =
      locations.find((l) => l.id === wanted)?.id ||
      locations.find((l) => l.id === scope.primaryStoreId)?.id ||
      locations[0].id;
    assertLocation(scope, location, false);

    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId: scope.tenantId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
        minStore: true,
        reorderQuantity: true,
        stockLevels: { where: { location }, select: { quantity: true, minQuantity: true, updatedAt: true } },
      },
    });

    const rows = ingredients.map((ing) => {
      const level = ing.stockLevels[0] ?? null;
      const quantity = level?.quantity ?? 0;
      const min = effectiveMin(location, level, ing);
      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        quantity,
        min,
        ownMin: level?.minQuantity ?? null,
        defaultMin: location === CENTRAL ? null : ing.minStore,
        below: isBelowMin(quantity, min),
        updatedAt: level?.updatedAt ?? null,
      };
    });

    const canEdit = location === CENTRAL ? can.manageCentralStock(scope.role) : can.manageStoreStock(scope.role);

    return NextResponse.json({
      ok: true,
      locations,
      location,
      canEdit,
      canManageCatalog: can.manageCatalog(scope.role),
      lowCount: rows.filter((r) => r.below).length,
      rows,
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock][GET]", error);
    return stockFail("Erro ao carregar o estoque.", 500);
  }
}

// Lancamento: entrada (compra/producao), perda, ou acerto (contagem: informa o total real).
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const location = String(body.location || "");
    assertLocation(scope, location, true);

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: String(body.ingredientId || ""), tenantId: scope.tenantId },
      select: { id: true, name: true },
    });
    if (!ingredient) return stockFail("Insumo não encontrado.", 404);

    const type = String(body.type || "");
    const note = String(body.note || "").trim().slice(0, 120) || null;
    let delta = 0;

    if (type === "entrada") {
      delta = positiveNumber(body.quantity, "Quantidade");
    } else if (type === "perda") {
      delta = -positiveNumber(body.quantity, "Quantidade");
    } else if (type === "ajuste") {
      const real = optionalNumber(body.quantity, "Quantidade contada");
      if (real === null) throw new StockInputError("Informe a quantidade contada.");
      const level = await prisma.stockLevel.findUnique({
        where: { ingredientId_location: { ingredientId: ingredient.id, location } },
        select: { quantity: true },
      });
      delta = real - (level?.quantity ?? 0);
    } else {
      throw new StockInputError("Tipo de lançamento inválido.");
    }

    await moveStock({
      tenantId: scope.tenantId,
      ingredientId: ingredient.id,
      location,
      delta,
      type,
      note,
      userId: scope.userId,
    });

    if (location !== CENTRAL && delta < 0) {
      await checkLowStock(scope.tenantId, location, [ingredient.id]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock][POST]", error);
    return stockFail("Erro ao lançar no estoque.", 500);
  }
}

// Minimo deste local (vazio = volta ao minimo padrao do insumo).
export async function PATCH(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const location = String(body.location || "");
    assertLocation(scope, location, true);

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: String(body.ingredientId || ""), tenantId: scope.tenantId },
      select: { id: true },
    });
    if (!ingredient) return stockFail("Insumo não encontrado.", 404);

    const minQuantity = optionalNumber(body.minQuantity, "Mínimo");

    await prisma.stockLevel.upsert({
      where: { ingredientId_location: { ingredientId: ingredient.id, location } },
      create: { tenantId: scope.tenantId, ingredientId: ingredient.id, location, quantity: 0, minQuantity },
      update: { minQuantity },
    });

    if (location !== CENTRAL) await checkLowStock(scope.tenantId, location, [ingredient.id]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock][PATCH]", error);
    return stockFail("Erro ao salvar o mínimo.", 500);
  }
}
