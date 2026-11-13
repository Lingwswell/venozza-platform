import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(
  req: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  try {
    if (!rateLimit(`order-lookup:${clientKey(req)}`, 1200, 60 * 1000)) {
      return NextResponse.json(
        { ok: false, error: "Muitas consultas. Tente novamente em instantes." },
        { status: 429 }
      );
    }

    const { codigo } = await context.params;
    const normalizedCode = String(codigo || "").trim().toUpperCase();

    if (!normalizedCode) {
      return NextResponse.json(
        { ok: false, error: "Código do pedido é obrigatório." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        orderCode: normalizedCode,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Pedido não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderCode: order.orderCode,
        customerName: String(order.customerName || "").trim().split(" ")[0] || null,
        subtotal_cents: order.subtotal_cents,
        freight_cents: order.freight_cents,
        total_cents: order.total_cents,
        paymentMethod: order.paymentMethod,
        orderType: order.orderType,
        status: order.status,
        storeId: order.storeId,
        storeName: order.store?.name ?? null,
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
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("[api/orders/:codigo][GET]", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao buscar pedido.",
      },
      { status: 500 }
    );
  }
}
