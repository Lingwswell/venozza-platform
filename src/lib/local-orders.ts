export const LOCAL_ORDER_CODES_KEY = "venozza_local_order_codes";
export const LEGACY_ORDER_CODES_KEY = "venozza_order_codes";
export const LEGACY_ORDER_HISTORY_KEY = "venozza_order_history";
export const ACTIVE_ORDER_KEY = "venozza_active_order_id";

type LocalOrderHistoryItem = {
  id?: string;
  code?: string;
  codigo?: string;
  orderCode?: string;
  order_code?: string;
  saved_at?: string;
  createdAt?: string;
};

function readJsonArray(key: string): unknown[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeOrderCode(value: unknown): string | null {
  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.startsWith("VZ-") ? text : null;
}

export function getLocalOrderCodes(): string[] {
  if (typeof window === "undefined") return [];

  const codes = new Set<string>();

  for (const item of readJsonArray(LOCAL_ORDER_CODES_KEY)) {
    const code = normalizeOrderCode(item);
    if (code) codes.add(code);
  }

  for (const item of readJsonArray(LEGACY_ORDER_CODES_KEY)) {
    const code = normalizeOrderCode(item);
    if (code) codes.add(code);
  }

  for (const item of readJsonArray(LEGACY_ORDER_HISTORY_KEY)) {
    const history = item as LocalOrderHistoryItem;

    const code =
      normalizeOrderCode(history?.orderCode) ||
      normalizeOrderCode(history?.order_code) ||
      normalizeOrderCode(history?.code) ||
      normalizeOrderCode(history?.codigo) ||
      normalizeOrderCode(history?.id);

    if (code) codes.add(code);
  }

  const activeOrder = normalizeOrderCode(
    window.localStorage.getItem(ACTIVE_ORDER_KEY)
  );

  if (activeOrder) codes.add(activeOrder);

  return Array.from(codes);
}

export function saveLocalOrderCode(orderCode: string) {
  if (typeof window === "undefined" || !orderCode) return;

  const normalized = normalizeOrderCode(orderCode);

  if (!normalized) return;

  const current = getLocalOrderCodes();
  const next = [normalized, ...current.filter((code) => code !== normalized)].slice(
    0,
    50
  );

  window.localStorage.setItem(LOCAL_ORDER_CODES_KEY, JSON.stringify(next));

  const history = readJsonArray(LEGACY_ORDER_HISTORY_KEY) as LocalOrderHistoryItem[];

  const historyWithoutDuplicate = history.filter((item) => {
    const code =
      normalizeOrderCode(item?.orderCode) ||
      normalizeOrderCode(item?.order_code) ||
      normalizeOrderCode(item?.code) ||
      normalizeOrderCode(item?.codigo) ||
      normalizeOrderCode(item?.id);

    return code !== normalized;
  });

  const nextHistory = [
    {
      id: normalized,
      orderCode: normalized,
      order_code: normalized,
      saved_at: new Date().toISOString(),
    },
    ...historyWithoutDuplicate,
  ].slice(0, 50);

  window.localStorage.setItem(
    LEGACY_ORDER_HISTORY_KEY,
    JSON.stringify(nextHistory)
  );

  window.localStorage.setItem(ACTIVE_ORDER_KEY, normalized);
}

export function clearLocalOrderCodes() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(LOCAL_ORDER_CODES_KEY);
  window.localStorage.removeItem(LEGACY_ORDER_CODES_KEY);
  window.localStorage.removeItem(LEGACY_ORDER_HISTORY_KEY);
  window.localStorage.removeItem(ACTIVE_ORDER_KEY);
}
