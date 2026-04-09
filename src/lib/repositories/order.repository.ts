import { AppError } from "@/lib/api/errors";
import type { CreateOrderInput, CreateOrderResult } from "@/types/order";

type PrismaLike = {
  order?: {
    create?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

async function getDb(): Promise<PrismaLike | null> {
  try {
    const mod = await import("@/lib/db");
    const m = mod as Record<string, unknown>;
    return (m.default ?? m.db ?? m.prisma ?? null) as PrismaLike | null;
  } catch {
    try {
      const mod = await import("@/lib/db/index");
      const m = mod as Record<string, unknown>;
      return (m.default ?? m.db ?? m.prisma ?? null) as PrismaLike | null;
    } catch {
      return null;
    }
  }
}

export class OrderRepository {
  static async create(input: CreateOrderInput & {
    subtotal_cents: number;
    freight_cents: number;
    total_cents: number;
    order_code: string;
    status: string;
    customer_name_normalized?: string;
    customer_phone_normalized?: string;
  }): Promise<CreateOrderResult> {
    const db = await getDb();

    if (!db?.order?.create) {
      throw new AppError(
        "Repository ainda não conectado ao banco nesta etapa. A rota legada será usada como fallback.",
        501
      );
    }

    const created = await db.order.create({
      data: {
        customer_name: input.customer_name_normalized ?? input.customer_name ?? input.customerName ?? null,
        customer_phone: input.customer_phone_normalized ?? input.customer_phone ?? input.phone ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        order_type: input.order_type ?? "entrega",
        channel: input.channel ?? "app",
        payment_method: input.payment_method ?? "pix",
        store_id: input.store_id ?? null,
        store_name: input.store_name ?? null,
        subtotal_cents: input.subtotal_cents,
        freight_cents: input.freight_cents,
        total_cents: input.total_cents,
        status: input.status,
        order_code: input.order_code,
        items_json: JSON.stringify(input.items ?? []),
      },
    });

    return {
      orderId: (created.id as number | string | undefined) ?? input.order_code,
      orderCode: input.order_code,
      status: "novo",
      subtotal_cents: input.subtotal_cents,
      freight_cents: input.freight_cents,
      total_cents: input.total_cents,
      store_id: input.store_id ?? null,
    };
  }
}
