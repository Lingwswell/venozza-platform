import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse, storeFilter } from "@/lib/auth/scope";
import { can } from "@/lib/auth/roles";
import { toSettingsData } from "@/lib/store/settings";
import { getOpenStatus } from "@/lib/store/settings-shared";

// Monitor da operacao: pedidos em andamento de varias lojas ao mesmo tempo.
// Dono da rede ve todas as lojas; franqueado ve as lojas dele.

const ACTIVE_STATUSES = ["novo", "preparo", "pronto", "saiu_entrega"];

function startOfTodayIn(timezone: string) {
  // Meia-noite de hoje no fuso da loja, em UTC.
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const local = new Date(`${parts}T00:00:00Z`);
  const offsetMs =
    new Date(now.toLocaleString("en-US", { timeZone: timezone })).getTime() -
    new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(local.getTime() - offsetMs);
}

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.viewMonitor(scope.role)) {
      return NextResponse.json({ ok: false, error: "Sem permissão para o monitor." }, { status: 403 });
    }

    const requestedStoreId = new URL(req.url).searchParams.get("storeId");
    const filter = storeFilter(scope, requestedStoreId);

    const stores = await prisma.store.findMany({
      where: {
        tenantId: scope.tenantId,
        active: true,
        ...(filter.storeId ? { id: filter.storeId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, settings: true },
    });

    const settingsByStore = new Map(stores.map((s) => [s.id, toSettingsData(s.settings)]));
    const timezone = stores[0] ? settingsByStore.get(stores[0].id)!.timezone : "America/Sao_Paulo";
    const todayStart = startOfTodayIn(timezone);

    const [activeOrders, todayByStore] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId: scope.tenantId, ...filter, status: { in: ACTIVE_STATUSES } },
        orderBy: { createdAt: "asc" },
        take: 300,
        select: {
          id: true,
          orderCode: true,
          storeId: true,
          status: true,
          customerName: true,
          total_cents: true,
          createdAt: true,
          items: { select: { name: true, quantity: true } },
        },
      }),
      prisma.order.groupBy({
        by: ["storeId", "status"],
        where: { tenantId: scope.tenantId, ...filter, createdAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { total_cents: true },
      }),
    ]);

    const now = Date.now();
    const storeName = new Map(stores.map((s) => [s.id, s.name]));

    const orders = activeOrders.map((order) => {
      const settings = settingsByStore.get(order.storeId);
      const elapsedMin = Math.floor((now - order.createdAt.getTime()) / 60000);
      const max = settings?.deliveryTimeMaxMinutes ?? 45;
      const min = settings?.deliveryTimeMinMinutes ?? 30;
      // "saiu_entrega" conta o tempo total ate o cliente; os outros, o tempo na loja.
      const late = elapsedMin > max;
      const warning = !late && elapsedMin > min;

      return {
        id: order.id,
        orderCode: order.orderCode,
        storeId: order.storeId,
        storeName: storeName.get(order.storeId) || "Loja",
        status: order.status,
        customerFirstName: order.customerName.split(" ")[0] || "",
        total_cents: order.total_cents,
        createdAt: order.createdAt,
        elapsedMin,
        late,
        warning,
        items: order.items.map((i) => `${i.quantity}× ${i.name}`),
      };
    });

    const storeSummaries = stores.map((store) => {
      const mine = orders.filter((o) => o.storeId === store.id);
      const today = todayByStore.filter((row) => row.storeId === store.id);
      const valid = today.filter((row) => row.status !== "cancelado");

      return {
        id: store.id,
        name: store.name,
        status: getOpenStatus(settingsByStore.get(store.id)!),
        active: mine.length,
        late: mine.filter((o) => o.late).length,
        byStatus: Object.fromEntries(
          ACTIVE_STATUSES.map((st) => [st, mine.filter((o) => o.status === st).length])
        ),
        todayOrders: valid.reduce((sum, row) => sum + row._count._all, 0),
        todayRevenue_cents: valid.reduce((sum, row) => sum + (row._sum.total_cents || 0), 0),
        todayCancelled: today
          .filter((row) => row.status === "cancelado")
          .reduce((sum, row) => sum + row._count._all, 0),
      };
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        active: orders.length,
        late: orders.filter((o) => o.late).length,
        warning: orders.filter((o) => o.warning).length,
        todayOrders: storeSummaries.reduce((s, x) => s + x.todayOrders, 0),
        todayRevenue_cents: storeSummaries.reduce((s, x) => s + x.todayRevenue_cents, 0),
      },
      stores: storeSummaries,
      orders,
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/monitor][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao carregar o monitor." }, { status: 500 });
  }
}
