export const LOCAL_ORDER_CODES_KEY = "venozza_local_order_codes";

export function getLocalOrderCodes(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_ORDER_CODES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}

export function saveLocalOrderCode(orderCode: string) {
  if (typeof window === "undefined" || !orderCode) return;

  const current = getLocalOrderCodes();
  if (current.includes(orderCode)) return;

  const next = [orderCode, ...current].slice(0, 50);
  window.localStorage.setItem(LOCAL_ORDER_CODES_KEY, JSON.stringify(next));
}

export function clearLocalOrderCodes() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_ORDER_CODES_KEY);
}
