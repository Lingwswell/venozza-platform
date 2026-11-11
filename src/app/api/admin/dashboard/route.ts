import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse, storeFilter } from "@/lib/auth/scope";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const requestedStoreId = new URL(req.url).searchParams.get("storeId");
    const filter = storeFilter(scope, requestedStoreId);

    const todayStart = startOfToday();

    const orderWhere = {
      tenantId: scope.tenantId,
      ...filter,
      createdAt: {
        gte: todayStart,
      },
    };

    const storeWhere = {
      tenantId: scope.tenantId,
      active: true,
      ...(filter.storeId ? { id: filter.storeId } : {}),
    };

    const [ordersToday, revenueAgg, activeStores] = await Promise.all([
      prisma.order.count({
        where: orderWhere,
      }),
      prisma.order.aggregate({
        where: orderWhere,
        _sum: {
          total_cents: true,
        },
      }),
      prisma.store.count({
        where: storeWhere,
      }),
    ]);

    const revenue_cents = revenueAgg._sum.total_cents || 0;
    const average_ticket_cents =
      ordersToday > 0 ? Math.round(revenue_cents / ordersToday) : 0;

    return NextResponse.json({
      ok: true,
      metrics: {
        orders_today: ordersToday,
        revenue_cents,
        average_ticket_cents,
        active_stores: activeStores,
      },
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/dashboard][GET]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar métricas do dashboard" },
      { status: 500 }
    );
  }
}
