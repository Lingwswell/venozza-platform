import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse, storeFilter } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { OPEN_SUPPLY_STATUSES } from "@/lib/stock/server";
import { StockInputError, assertLocation, positiveNumber, stockFail, supplySelect } from "@/lib/stock/access";

// Pedidos de abastecimento das lojas para a cozinha central.


export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.viewStock(scope.role)) return stockFail("Sem acesso ao estoque.", 403);

    // Cozinha central e a rede veem todos os pedidos; loja ve os dela.
    const where =
      scope.role === "kitchen_operator" || scope.networkWide
        ? { tenantId: scope.tenantId }
        : { tenantId: scope.tenantId, ...storeFilter(scope) };

    const url = new URL(req.url);
    const onlyOpen = url.searchParams.get("open") === "1";

    const requests = await prisma.supplyRequest.findMany({
      where: { ...where, ...(onlyOpen ? { status: { in: OPEN_SUPPLY_STATUSES } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: supplySelect,
    });

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/supply][GET]", error);
    return stockFail("Erro ao carregar os pedidos de abastecimento.", 500);
  }
}

// Pedido manual da loja (ex.: antes de um feriado).
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const storeId = String(body.storeId || "");
    assertLocation(scope, storeId, true);

    const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    const merged = new Map<string, number>();
    for (const raw of rawItems) {
      const ingredientId = String(raw?.ingredientId || "");
      if (!ingredientId) continue;
      merged.set(ingredientId, (merged.get(ingredientId) || 0) + positiveNumber(raw.quantity, "Quantidade"));
    }
    if (merged.size === 0) throw new StockInputError("Escolha pelo menos um insumo.");

    const valid = await prisma.ingredient.count({
      where: { id: { in: Array.from(merged.keys()) }, tenantId: scope.tenantId, active: true },
    });
    if (valid !== merged.size) throw new StockInputError("Insumo inválido no pedido.");

    const request = await prisma.supplyRequest.create({
      data: {
        tenantId: scope.tenantId,
        storeId,
        origin: "manual",
        status: "aberto",
        note: String(body.note || "").trim().slice(0, 200) || null,
        items: {
          create: Array.from(merged.entries()).map(([ingredientId, quantityRequested]) => ({
            ingredientId,
            quantityRequested,
          })),
        },
      },
      select: supplySelect,
    });

    return NextResponse.json({ ok: true, request }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof StockInputError) return stockFail((error as Error).message, 400);
    console.error("[api/admin/stock/supply][POST]", error);
    return stockFail("Erro ao criar o pedido.", 500);
  }
}
