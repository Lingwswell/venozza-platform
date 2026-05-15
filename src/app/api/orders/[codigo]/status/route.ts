import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";
import {
  getKdsRealtimeAdapter,
  getStoreChannel,
  getTenantChannel,
} from "@/lib/realtime/kds-realtime";

const STATUS_FLOW: Record<string, string[]> = {
  novo: ["preparo", "cancelado"],
  preparo: ["pronto", "cancelado"],
  pronto: ["saiu_entrega", "finalizado"],
  saiu_entrega: ["finalizado"],
  finalizado: [],
  cancelado: [],
};

export async function PATCH(
  req: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  try {
    const auth = await getAuthContextFromRequest(req);

    if (!auth.tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId obrigatório" },
        { status: 400 }
      );
    }

    const { codigo } = await context.params;
    const body = await req.json().catch(() => null);
    const nextStatus = body?.status;

    if (!nextStatus || typeof nextStatus !== "string") {
      return NextResponse.json(
        { ok: false, error: "Status é obrigatório" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        orderCode: codigo,
        tenantId: auth.tenantId,
        ...(auth.role === "owner"
          ? {}
          : { storeId: auth.storeId || "__NO_STORE__" }),
      },
      include: {
        store: {
          select: { id: true, name: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    const allowed = STATUS_FLOW[order.status] || [];

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Transição inválida: ${order.status} -> ${nextStatus}`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
      },
      include: {
        store: {
          select: { id: true, name: true },
        },
      },
    });

    const realtime = getKdsRealtimeAdapter();

    await realtime.publish(getTenantChannel(auth.tenantId), {
      type: "order_status_changed",
      orderId: updated.id,
      orderCode: updated.orderCode,
      status: updated.status,
      storeId: updated.storeId,
      tenantId: updated.tenantId,
      ts: Date.now(),
    });

    await realtime.publish(getStoreChannel(auth.tenantId, updated.storeId), {
      type: "order_status_changed",
      orderId: updated.id,
      orderCode: updated.orderCode,
      status: updated.status,
      storeId: updated.storeId,
      tenantId: updated.tenantId,
      ts: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      order: updated,
    });
  } catch (error) {
    console.error("[api/orders/:codigo/status][PATCH]", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar status" },
      { status: 500 }
    );
  }
}
