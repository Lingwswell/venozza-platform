import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

type RangeKey =
  | "today"
  | "yesterday"
  | "last7days"
  | "thisMonth"
  | "lastMonth"
  | "custom";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getRangeDates(
  range: RangeKey,
  startParam: string | null,
  endParam: string | null
) {
  const now = new Date();

  switch (range) {
    case "today": {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    }

    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };
    }

    case "last7days": {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);

      return {
        start: startOfDay(start),
        end: endOfDay(now),
      };
    }

    case "thisMonth": {
      return {
        start: startOfMonth(now),
        end: endOfDay(now),
      };
    }

    case "lastMonth": {
      const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      return {
        start: startOfMonth(ref),
        end: endOfMonth(ref),
      };
    }

    case "custom": {
      if (!startParam || !endParam) {
        throw new Error("start e end são obrigatórios para range=custom");
      }

      const start = new Date(`${startParam}T00:00:00.000`);
      const end = new Date(`${endParam}T23:59:59.999`);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Período custom inválido");
      }

      if (start > end) {
        throw new Error("start não pode ser maior que end");
      }

      return { start, end };
    }

    default: {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    }
  }
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

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "today") as RangeKey;
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");
    const requestedStoreId = url.searchParams.get("storeId")?.trim() || null;

    const { start, end } = getRangeDates(range, startParam, endParam);

    const role = String(auth.role || "").toLowerCase();

    const effectiveStoreId =
      role === "owner"
        ? requestedStoreId
        : auth.storeId || null;

    const where = {
      tenantId: auth.tenantId,
      ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    const [
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      operationalOrders,
      revenueAgg,
    ] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({
        where: {
          ...where,
          status: { in: ["finalizado", "entregue"] },
        },
      }),
      prisma.order.count({
        where: {
          ...where,
          status: "cancelado",
        },
      }),
      prisma.order.count({
        where: {
          ...where,
          status: { in: ["novo", "preparo", "pronto", "saiu_entrega"] },
        },
      }),
      prisma.order.aggregate({
        where: {
          ...where,
          status: { not: "cancelado" },
        },
        _sum: {
          total_cents: true,
        },
      }),
    ]);

    const revenue_cents = revenueAgg._sum.total_cents || 0;
    const average_ticket_cents =
      totalOrders > 0 ? Math.round(revenue_cents / totalOrders) : 0;

    return NextResponse.json({
      ok: true,
      filters: {
        range,
        tenantId: auth.tenantId,
        storeId: effectiveStoreId,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      metrics: {
        total_orders: totalOrders,
        delivered_orders: deliveredOrders,
        cancelled_orders: cancelledOrders,
        operational_orders: operationalOrders,
        revenue_cents,
        average_ticket_cents,
      },
    });
  } catch (error) {
    console.error("[api/admin/dashboard/metrics][GET]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Erro ao carregar métricas por período";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
