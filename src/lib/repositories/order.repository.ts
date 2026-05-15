import { AppError } from "@/lib/api/errors";
import type { CreateOrderInput, CreateOrderResult } from "@/types/order";

type OrderStatus =
  | "novo"
  | "preparo"
  | "pronto"
  | "saiu_entrega"
  | "finalizado"
  | "cancelado";

type PrismaOrderDelegate = {
  create?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  findUnique?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  findFirst?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  findMany?: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  update?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateMany?: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

type PrismaProductStoreDelegate = {
  updateMany?: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

type PrismaLike = {
  order?: PrismaOrderDelegate;
  productStore?: PrismaProductStoreDelegate;
  $transaction?: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
};

async function getDb(): Promise<PrismaLike | null> {
  try {
    const mod = await import("@/lib/db");
    const m = mod as Record<string, unknown>;
    return (m.default ?? m.prisma ?? null) as PrismaLike | null;
  } catch {
    try {
      const mod = await import("@/lib/db/index");
      const m = mod as Record<string, unknown>;
      return (m.default ?? m.prisma ?? null) as PrismaLike | null;
    } catch {
      return null;
    }
  }
}

export type OrderAccessScope = {
  tenantId: string;
  role: "owner" | "operator";
  storeId?: string | null;
  filterStoreId?: string | null;
};

type RepositoryCreateOrderInput = CreateOrderInput & {
  subtotal_cents: number;
  freight_cents: number;
  total_cents: number;
  order_code: string;
  status: string;
  customer_name_normalized?: string;
  customer_phone_normalized?: string;
  tenantId?: string;
  storeId?: string;
};

export class OrderRepository {
  static async create(input: RepositoryCreateOrderInput): Promise<CreateOrderResult> {
    const db = await getDb();

    if (!db?.order?.create) {
      throw new AppError(
        "Repository ainda não conectado ao banco nesta etapa. A rota legada será usada como fallback.",
        501
      );
    }

    const customerName =
      input.customer_name_normalized ||
      input.customer_name ||
      input.customerName ||
      "Cliente";

    const phone =
      input.customer_phone_normalized ||
      input.customer_phone ||
      input.phone ||
      "";

    const createOrder = async (tx: PrismaLike) => {
      if (!tx.order?.create) {
        throw new AppError("Criação de pedido indisponível no repository atual.", 501);
      }

      if (!tx.productStore?.updateMany) {
        throw new AppError("Controle de estoque indisponível no repository atual.", 501);
      }

      for (const item of input.items || []) {
        const productId =
          typeof item.id !== "undefined" && item.id !== null ? String(item.id) : "";

        const quantity = Number(item.quantity || 0);

        if (!productId || quantity <= 0) {
          throw new AppError("Item inválido para baixa de estoque.", 400);
        }

        const stockUpdate = await tx.productStore.updateMany({
          where: {
            productId,
            storeId: input.storeId,
            stock: {
              gte: quantity,
            },
            available: true,
          },
          data: {
            stock: {
              decrement: quantity,
            },
          },
        });

        if (stockUpdate.count !== 1) {
          throw new AppError(
            `Estoque insuficiente para ${item.name || "produto"}.`,
            400
          );
        }
      }

      return tx.order.create({
        data: {
          orderCode: input.order_code,
          tenantId: input.tenantId,
          storeId: input.storeId,
          customerName,
          phone,
          address: input.address ?? "",
          notes: input.notes ?? null,
          subtotal_cents: input.subtotal_cents,
          freight_cents: input.freight_cents,
          total_cents: input.total_cents,
          paymentMethod: input.payment_method ?? input.paymentMethod ?? "pix",
          status: input.status,

          items: {
            create: (input.items || []).map((item) => ({
              productId: typeof item.id !== "undefined" && item.id !== null ? String(item.id) : null,
              name: item.name,
              quantity: Number(item.quantity || 0),
              price_cents: Number(item.price_cents || 0),
              total_cents: Number(item.price_cents || 0) * Number(item.quantity || 0),
              note: item.note ?? null,
              size: item.size ?? null,
              crust: item.crust ?? null,
              addons_json: Array.isArray(item.addons)
                ? JSON.stringify(item.addons)
                : null,
            })),
          },
        },
        include: {
          items: true,
        },
      });
    };

    const created = db.$transaction
      ? await db.$transaction(createOrder)
      : await createOrder(db);

    return {
      orderId: (created.id as string | number | undefined) ?? input.order_code,
      orderCode: input.order_code,
      status: String(created.status ?? input.status ?? "novo"),
      subtotal_cents: input.subtotal_cents,
      freight_cents: input.freight_cents,
      total_cents: input.total_cents,
      store_id: input.storeId ?? null,
    };
  }

  static buildScopedWhere(codigo: string | null, access: OrderAccessScope) {
    const where: Record<string, unknown> = {
      tenantId: access.tenantId,
    };

    if (codigo) {
      where.orderCode = codigo;
    }

    if (access.role === "operator") {
      where.storeId = access.storeId ?? "__NO_STORE__";
    } else if (access.filterStoreId) {
      where.storeId = access.filterStoreId;
    }

    return where;
  }

  static async findByCodeScoped(codigo: string, access: OrderAccessScope) {
    const db = await getDb();

    if (!db?.order?.findFirst) {
      throw new AppError("Leitura de pedidos indisponível no repository atual.", 501);
    }

    return db.order.findFirst({
      where: this.buildScopedWhere(codigo, access),
      include: {
        store: true,
      },
    });
  }

  static async listKDSOrdersScoped(access: OrderAccessScope) {
    const db = await getDb();

    if (!db?.order?.findMany) {
      throw new AppError("Listagem KDS indisponível no repository atual.", 501);
    }

    return db.order.findMany({
      where: {
        ...this.buildScopedWhere(null, access),
        status: {
          in: ["novo", "preparo", "pronto", "saiu_entrega"],
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        store: true,
      },
    });
  }

  static async updateStatusScoped(
    codigo: string,
    nextStatus: OrderStatus,
    access: OrderAccessScope
  ) {
    const db = await getDb();

    if (!db?.order?.updateMany) {
      throw new AppError("Atualização de status indisponível no repository atual.", 501);
    }

    return db.order.updateMany({
      where: this.buildScopedWhere(codigo, access),
      data: {
        status: nextStatus,
      },
    });
  }
}
