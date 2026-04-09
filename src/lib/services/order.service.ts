import { AppError } from "@/lib/api/errors";
import { OrderRepository } from "@/lib/repositories/order.repository";
import { validateCreateOrder } from "@/lib/validators/order.validator";
import type { CreateOrderInput, CreateOrderItemInput, CreateOrderResult } from "@/types/order";

function parseMoneyStringToCents(value?: string): number {
  if (!value) return 0;

  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const num = Number(normalized);
  if (Number.isNaN(num)) return 0;

  return Math.round(num * 100);
}

function getItemUnitPriceCents(item: CreateOrderItemInput): number {
  if (typeof item.price_cents === "number") return item.price_cents;
  return 0;
}

function getSubtotalCents(items: CreateOrderItemInput[]): number {
  return items.reduce((acc, item) => {
    const qty = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    return acc + getItemUnitPriceCents(item) * qty;
  }, 0);
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const onlyDigits = phone.replace(/\D/g, "");
  return onlyDigits || undefined;
}

function generateOrderCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `VZ-${n}`;
}

export class OrderService {
  static async create(rawInput: unknown): Promise<CreateOrderResult> {
    const input = validateCreateOrder(rawInput) as CreateOrderInput;

    if (!input.items?.length) {
      throw new AppError("Pedido sem itens.", 400);
    }

    const subtotal_cents =
      typeof input.subtotal_cents === "number"
        ? input.subtotal_cents
        : typeof input.subtotal === "number"
          ? Math.round(input.subtotal * 100)
          : getSubtotalCents(input.items);

    const freight_cents =
      typeof input.freight_cents === "number"
        ? input.freight_cents
        : typeof input.freight === "number"
          ? Math.round(input.freight * 100)
          : 0;

    const total_cents =
      typeof input.total_cents === "number"
        ? input.total_cents
        : typeof input.total === "number"
          ? Math.round(input.total * 100)
          : subtotal_cents + freight_cents;

    if (total_cents <= 0) {
      throw new AppError("Total do pedido inválido.", 400);
    }

    return OrderRepository.create({
      ...input,
      subtotal_cents,
      freight_cents,
      total_cents,
      order_code: generateOrderCode(),
      status: "novo",
      customer_name_normalized: input.customer_name ?? input.customerName,
      customer_phone_normalized: input.customer_phone ?? normalizePhone(input.phone),
    });
  }
}
