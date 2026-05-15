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

    const role = String(auth.role || "").toLowerCase();
    const effectiveStoreId =
      role === "owner" ? requestedStoreId : auth.storeId || null;

    const orders = await prisma.order.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          not: "cancelado",
        },
      },
      select: {
        storeId: true,
        total_cents: true,
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const map = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        storeSlug: string | null;
        revenue_cents: number;
        orders: number;
      }
    >();

    for (const order of orders) {
      const key = order.storeId;
      const current = map.get(key) || {
        storeId: order.storeId,
        storeName: order.store?.name || "Loja",
        storeSlug: order.store?.slug || null,
        revenue_cents: 0,
        orders: 0,
      };

      current.revenue_cents += Number(order.total_cents || 0);
      current.orders += 1;

      map.set(key, current);
    }

    const ranking = Array.from(map.values())
      .map((item) => ({
        ...item,
        average_ticket_cents:
          item.orders > 0 ? Math.round(item.revenue_cents / item.orders) : 0,
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents);

    return NextResponse.json({
      ok: true,
      filters: {
        range,
        tenantId: auth.tenantId,
        storeId: effectiveStoreId,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      ranking,
    });
  } catch (error) {
    console.error("[api/admin/financeiro/ranking-stores][GET]", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar ranking de lojas" },
      { status: 500 }
    );
  }
}
