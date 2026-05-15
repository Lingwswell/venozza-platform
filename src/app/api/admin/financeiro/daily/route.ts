import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";

type RangeKey =
  | "last7days"
  | "thisMonth"
  | "last30days";

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

function formatDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function buildRange(range: RangeKey) {
  const now = new Date();

  if (range === "thisMonth") {
    return {
      start: startOfMonth(now),
      end: endOfDay(now),
    };
  }

  if (range === "last30days") {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return {
      start: startOfDay(start),
      end: endOfDay(now),
    };
  }

  const start = new Date(now);
  start.setDate(now.getDate() - 6);

  return {
    start: startOfDay(start),
    end: endOfDay(now),
  };
}

function buildPreviousRange(range: RangeKey, currentStart: Date) {
  if (range === "thisMonth") {
    const ref = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
    return {
      start: startOfMonth(ref),
      end: endOfMonth(ref),
    };
  }

  if (range === "last30days") {
    const end = new Date(currentStart);
    end.setMilliseconds(-1);

    const start = new Date(currentStart);
    start.setDate(start.getDate() - 30);

    return {
      start: startOfDay(start),
      end,
    };
  }

  const end = new Date(currentStart);
  end.setMilliseconds(-1);

  const start = new Date(currentStart);
  start.setDate(start.getDate() - 7);

  return {
    start: startOfDay(start),
    end,
  };
}

async function getSummary(where: Record<string, unknown>) {
  const [orders, revenueAgg] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where,
      _sum: {
        total_cents: true,
      },
    }),
  ]);

  return {
    orders,
    revenue_cents: revenueAgg._sum.total_cents || 0,
  };
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
    const range = (url.searchParams.get("range") || "last7days") as RangeKey;
    const requestedStoreId = url.searchParams.get("storeId")?.trim() || null;

    const { start, end } = buildRange(range);
    const previous = buildPreviousRange(range, start);

    const role = String(auth.role || "").toLowerCase();
    const effectiveStoreId =
      role === "owner" ? requestedStoreId : auth.storeId || null;

    const baseWhere = {
      tenantId: auth.tenantId,
      ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
      status: {
        not: "cancelado",
      },
    };

    const currentWhere = {
      ...baseWhere,
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    const previousWhere = {
      ...baseWhere,
      createdAt: {
        gte: previous.start,
        lte: previous.end,
      },
    };

    const [orders, currentSummary, previousSummary] = await Promise.all([
      prisma.order.findMany({
        where: currentWhere,
        select: {
          createdAt: true,
          total_cents: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      getSummary(currentWhere),
      getSummary(previousWhere),
    ]);

    const bucket = new Map<string, { label: string; revenue_cents: number; orders: number }>();

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = formatDayKey(cursor);
      bucket.set(key, {
        label: formatDayLabel(cursor),
        revenue_cents: 0,
        orders: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const order of orders) {
      const date = new Date(order.createdAt);
      const key = formatDayKey(date);

      const current = bucket.get(key);
      if (!current) continue;

      current.revenue_cents += Number(order.total_cents || 0);
      current.orders += 1;
    }

    return NextResponse.json({
      ok: true,
      filters: {
        range,
        tenantId: auth.tenantId,
        storeId: effectiveStoreId,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      comparison: {
        current: currentSummary,
        previous: previousSummary,
      },
      series: Array.from(bucket.entries()).map(([date, value]) => ({
        date,
        label: value.label,
        revenue_cents: value.revenue_cents,
        orders: value.orders,
      })),
    });
  } catch (error) {
    console.error("[api/admin/financeiro/daily][GET]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar gráfico diário" },
      { status: 500 }
    );
  }
}
