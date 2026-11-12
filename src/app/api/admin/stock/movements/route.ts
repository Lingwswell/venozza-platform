import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertLocation, stockFail } from "@/lib/stock/access";

// Historico de um local (ultimos 150 movimentos; opcionalmente de um insumo so).
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const url = new URL(req.url);
    const location = url.searchParams.get("location") || "";
    assertLocation(scope, location, false);
    const ingredientId = url.searchParams.get("ingredientId") || undefined;

    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: scope.tenantId, location, ...(ingredientId ? { ingredientId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        type: true,
        quantity: true,
        note: true,
        createdAt: true,
        ingredient: { select: { name: true, unit: true } },
      },
    });

    return NextResponse.json({ ok: true, movements });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/movements][GET]", error);
    return stockFail("Erro ao carregar o histórico.", 500);
  }
}
