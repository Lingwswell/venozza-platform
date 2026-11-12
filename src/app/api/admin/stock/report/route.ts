import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertLocation, stockFail, stockLocations } from "@/lib/stock/access";
import { buildLocationReport, percent, totalLossCents } from "@/lib/stock/report";

// Relatorio do periodo: comparativo entre lojas (venda, CMV, perda) e o detalhe por insumo de um local.
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const locations = await stockLocations(scope);
    if (locations.length === 0) return stockFail("Sem acesso ao estoque.", 403);

    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const wanted = url.searchParams.get("location") || "";
    const detailLocation = locations.find((l) => l.id === wanted)?.id || locations.find((l) => !l.central)?.id || locations[0].id;
    assertLocation(scope, detailLocation, false);

    const locationIds = locations.map((l) => l.id);
    const storeIds = locations.filter((l) => !l.central).map((l) => l.id);

    const [sumsRaw, ingredients, revenue] = await Promise.all([
      prisma.stockMovement.groupBy({
        by: ["location", "ingredientId", "type"],
        where: { tenantId: scope.tenantId, location: { in: locationIds }, createdAt: { gte: since } },
        _sum: { quantity: true },
      }),
      prisma.ingredient.findMany({
        where: { tenantId: scope.tenantId },
        select: { id: true, name: true, unit: true, costCents: true },
      }),
      // Venda sem frete (o CMV compara com o que foi vendido de comida).
      prisma.order.groupBy({
        by: ["storeId"],
        where: { storeId: { in: storeIds }, createdAt: { gte: since }, status: { not: "cancelado" } },
        _sum: { subtotal_cents: true },
        _count: { _all: true },
      }),
    ]);

    const sums = sumsRaw.map((s) => ({
      location: s.location,
      ingredientId: s.ingredientId,
      type: s.type,
      quantity: s._sum.quantity ?? 0,
    }));
    const revenueBy = new Map(revenue.map((r) => [r.storeId, r] as const));

    const stores = locations
      .filter((l) => !l.central)
      .map((l) => {
        const { totals } = buildLocationReport(sums, ingredients, l.id);
        const rev = revenueBy.get(l.id);
        const revenueCents = rev?._sum.subtotal_cents ?? 0;
        const lossCents = totalLossCents(totals);
        return {
          id: l.id,
          name: l.name,
          orders: rev?._count._all ?? 0,
          revenueCents,
          cmvCents: totals.usedCents,
          cmvPct: percent(totals.usedCents, revenueCents),
          lossCents,
          lossPct: percent(lossCents, revenueCents),
          missingCost: totals.missingCost,
        };
      });

    const detail = buildLocationReport(sums, ingredients, detailLocation);

    return NextResponse.json({
      ok: true,
      days,
      locations,
      location: detailLocation,
      stores,
      detail: { ...detail, lossCents: totalLossCents(detail.totals) },
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/stock/report][GET]", error);
    return stockFail("Erro ao montar o relatório.", 500);
  }
}
