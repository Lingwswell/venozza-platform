export type OrderStatus =
  | "novo"
  | "preparo"
  | "pronto"
  | "saiu_entrega"
  | "finalizado"
  | "cancelado";

export const KDS_VISIBLE_STATUSES: OrderStatus[] = [
  "novo",
  "preparo",
  "pronto",
  "saiu_entrega",
];

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  novo: ["preparo", "cancelado"],
  preparo: ["pronto", "cancelado"],
  pronto: ["saiu_entrega", "finalizado"],
  saiu_entrega: ["finalizado"],
  finalizado: [],
  cancelado: [],
};

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    ["novo", "preparo", "pronto", "saiu_entrega", "finalizado", "cancelado"].includes(value)
  );
}

export function canTransitionOrderStatus(
  current: OrderStatus,
  next: OrderStatus
): boolean {
  return ORDER_STATUS_FLOW[current]?.includes(next) ?? false;
}

export function getNextOrderStatus(
  current: OrderStatus
): OrderStatus | null {
  switch (current) {
    case "novo":
      return "preparo";
    case "preparo":
      return "pronto";
    case "pronto":
      return "saiu_entrega";
    case "saiu_entrega":
      return "finalizado";
    default:
      return null;
  }
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "novo":
      return "Novo";
    case "preparo":
      return "Preparo";
    case "pronto":
      return "Pronto";
    case "saiu_entrega":
      return "Saiu para entrega";
    case "finalizado":
      return "Finalizado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}
