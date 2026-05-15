import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthContextFromRequest(req);

    if (!auth.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId obrigatório" },
        { status: 400 }
      );
    }

    const todayStart = startOfToday();

    const orderWhere = {
      tenantId: auth.tenantId,
      ...(String(auth.role).toLowerCase() === "owner"
        ? {}
        : { storeId: auth.storeId || "__NO_STORE__" }),
      createdAt: {
        gte: todayStart,
      },
    };

    const storeWhere = {
      tenantId: auth.tenantId,
      active: true,
      ...(String(auth.role).toLowerCase() === "owner"
        ? {}
        : { id: auth.storeId || "__NO_STORE__" }),
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
    console.error("[api/admin/dashboard][GET]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar métricas do dashboard" },
      { status: 500 }
    );
  }
}
