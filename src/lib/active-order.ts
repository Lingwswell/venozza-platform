const ACTIVE_ORDER_KEY = "venozza_active_order_id";

export function setActiveOrderId(orderId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_ORDER_KEY, orderId);
}

export function getActiveOrderId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ORDER_KEY);
}

export function clearActiveOrderId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_ORDER_KEY);
}
