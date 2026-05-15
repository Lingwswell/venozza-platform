import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";
import { OrderService } from "@/lib/services/order.service";
import {
  getKdsRealtimeAdapter,
  getStoreChannel,
  getTenantChannel,
} from "@/lib/realtime/kds-realtime";

type OrderItem = {
  id: string | number;
  name: string;
  quantity: number;
  price_cents?: number;
  image?: string;
  note?: string;
  addons?: string[];
  size?: string;
  crust?: string;
};

type OrderPayload = {
  customerName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  items?: OrderItem[];
  subtotal_cents?: number;
  deliveryFee?: number;
  freight_cents?: number;
  total_cents?: number;
  paymentMethod?: string;
};

function getStatusFilter(scope: string | null) {
  switch ((scope || "all").toLowerCase()) {
    case "operational":
      return ["novo", "preparo", "pronto", "saiu_entrega"];
    case "completed":
      return ["finalizado", "entregue"];
    case "cancelled":
      return ["cancelado"];
    default:
      return null;
  }
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthContextFromRequest(req);

    if (!auth.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId é obrigatório" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const requestStoreId = req.headers.get("x-store-id")?.trim() || null;
    const requestedScope = url.searchParams.get("scope");
    const statusFilter = getStatusFilter(requestedScope);

    const where: {
      tenantId: string;
      storeId?: string;
      status?: { in: string[] };
    } = {
      tenantId: auth.tenantId,
    };

    if (String(auth.role || "").toLowerCase() !== "owner") {
      const effectiveStoreId = auth.storeId || requestStoreId;

      if (!effectiveStoreId) {
        return NextResponse.json(
          { ok: false, error: "storeId é obrigatório para este usuário" },
          { status: 400 }
        );
      }

      where.storeId = effectiveStoreId;
    }

    if (statusFilter) {
      where.status = { in: statusFilter };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      scope: {
        requested: requestedScope || "all",
        tenantId: auth.tenantId,
        storeId: where.storeId ?? null,
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        total: order.total_cents / 100,
        total_cents: order.total_cents,
        status: order.status,
        store_id: order.storeId,
        store_name: order.store?.name ?? null,
        paymentMethod: order.paymentMethod,
        subtotal_cents: order.subtotal_cents,
        freight_cents: order.freight_cents,
        notes: order.notes,
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price_cents: item.price_cents,
          total_cents: item.total_cents,
          note: item.note,
          size: item.size,
          crust: item.crust,
          addons: item.addons_json ? JSON.parse(item.addons_json) : [],
        })),
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    console.error("[api/orders][GET]", error);

    const message =
      error instanceof Error ? error.message : "Erro ao listar pedidos.";

    const status =
      message.includes("Authorization") || message.includes("Usuário inválido")
        ? 401
        : 500;

    return NextResponse.json(
      { ok: false, error: message || "Erro ao listar pedidos." },
      { status }
    );
  }
}

export async function POST(req: Request) {
  try {
    console.log(
      "[api/orders][POST] authorization?",
      req.headers.get("authorization") ? "SIM" : "NAO"
    );
    console.log("[api/orders][POST] x-store-id:", req.headers.get("x-store-id"));

    let auth: {
      tenantId?: string | null;
      storeId?: string | null;
      role?: string | null;
    } = {};

    try {
      auth = await getAuthContextFromRequest(req);
    } catch (error) {
      console.warn("[api/orders][POST][auth ignored]", error);
    }

    const body = (await req.json()) as OrderPayload;

    const headerStoreId = req.headers.get("x-store-id")?.trim() || null;
    const effectiveStoreId = auth.storeId || headerStoreId;

    console.log("[api/orders][POST][store-resolution]", {
      authStoreId: auth.storeId ?? null,
      headerStoreId,
      effectiveStoreId,
      role: auth.role ?? null,
      tenantId: auth.tenantId ?? null,
    });

    if (!effectiveStoreId) {
      return NextResponse.json(
        {
          ok: false,
          error: "storeId é obrigatório via auth ou header x-store-id.",
        },
        { status: 400 }
      );
    }

    const store = await prisma.store.findFirst({
      where: {
        id: effectiveStoreId,
        active: true,
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!store) {
      return NextResponse.json(
        {
          ok: false,
          error: "Loja inválida.",
        },
        { status: 400 }
      );
    }

    const effectiveTenantId = auth.tenantId || store.tenantId;

    if (!effectiveTenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId é obrigatório" },
        { status: 400 }
      );
    }

    if (auth.tenantId && auth.tenantId !== store.tenantId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Loja inválida para o tenant autenticado.",
        },
        { status: 400 }
      );
    }

    const created = await OrderService.create({
      ...body,
      tenantId: effectiveTenantId,
      storeId: store.id,
    });

    const order = await prisma.order.findUnique({
      where: {
        orderCode: created.orderCode,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Pedido criado, mas não foi possível recarregar os dados." },
        { status: 500 }
      );
    }

    const realtime = getKdsRealtimeAdapter();

    await realtime.publish(getTenantChannel(order.tenantId), {
      type: "order_created",
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      storeId: order.storeId,
      tenantId: order.tenantId,
      ts: Date.now(),
    });

    await realtime.publish(getStoreChannel(order.tenantId, order.storeId), {
      type: "order_created",
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      storeId: order.storeId,
      tenantId: order.tenantId,
      ts: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderCode: order.orderCode,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        subtotal_cents: order.subtotal_cents,
        freight_cents: order.freight_cents,
        total_cents: order.total_cents,
        total: order.total_cents / 100,
        paymentMethod: order.paymentMethod,
        status: order.status,
        storeId: order.storeId,
        storeName: order.store?.name ?? null,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("[api/orders][POST]", error);

    const message =
      error instanceof Error ? error.message : "Erro ao criar pedido.";

    const status =
      message.includes("Authorization") ||
      message.includes("Usuário inválido") ||
      message.includes("Token inválido")
        ? 401
        : message.includes("obrigatório") || message.includes("inválido")
          ? 400
          : 500;

    return NextResponse.json(
      { ok: false, error: message || "Erro ao criar pedido." },
      { status }
    );
  }
}
