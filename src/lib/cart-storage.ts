import type { CartItem } from "@/types/order";

const STORAGE_KEY = "venozza_cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalizeItem(item: CartItem): CartItem {
  return {
    ...item,
    id: item.id,
    name: String(item.name || ""),
    quantity: Number(item.quantity || 1),
    price_cents: Number(item.price_cents || 0),
    image: item.image || "",
    note: item.note || "",
    addons: Array.isArray(item.addons) ? item.addons : [],
    size: item.size || "",
    crust: item.crust || "",
    tenantId: item.tenantId ? String(item.tenantId) : undefined,
    storeId: item.storeId ? String(item.storeId) : undefined,
  };
}

function sameId(a: string | number, b: string | number) {
  return String(a) === String(b);
}

function isValidCartItem(item: CartItem) {
  return (
    String(item.id || "").length > 0 &&
    String(item.name || "").length > 0 &&
    Number.isFinite(Number(item.quantity || 0)) &&
    Number(item.quantity || 0) > 0 &&
    Number.isFinite(Number(item.price_cents || 0)) &&
    Number(item.price_cents || 0) > 0
  );
}

export function getCartItems(): CartItem[] {
  return readCart().map(normalizeItem).filter(isValidCartItem);
}

export function getCartItemsByStore(storeId: string): CartItem[] {
  return getCartItems().filter((item) => item.storeId === storeId);
}

export function getCartCount() {
  return getCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function getCartCountByStore(storeId: string) {
  return getCartItemsByStore(storeId).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
}

export function getCartSubtotal() {
  return getCartItems().reduce(
    (sum, item) => sum + Number(item.price_cents || 0) * Number(item.quantity || 0),
    0
  );
}

export function getCartSubtotalByStore(storeId: string) {
  return getCartItemsByStore(storeId).reduce(
    (sum, item) => sum + Number(item.price_cents || 0) * Number(item.quantity || 0),
    0
  );
}

export function addToCart(item: CartItem) {
  const items = getCartItems();
  const normalized = normalizeItem(item);

  const index = items.findIndex(
    (current) =>
      sameId(current.id, normalized.id) &&
      current.name === normalized.name &&
      current.storeId === normalized.storeId &&
      String(current.size || "") === String(normalized.size || "") &&
      String(current.crust || "") === String(normalized.crust || "") &&
      JSON.stringify(current.addons || []) === JSON.stringify(normalized.addons || []) &&
      String(current.note || "") === String(normalized.note || "")
  );

  if (index >= 0) {
    items[index].quantity += normalized.quantity || 1;
  } else {
    items.push(normalized);
  }

  writeCart(items);
}

export function incrementCartItem(id: string | number) {
  const items = getCartItems().map((item) =>
    sameId(item.id, id) ? { ...item, quantity: item.quantity + 1 } : item
  );
  writeCart(items);
}

export function decrementCartItem(id: string | number) {
  const items = getCartItems()
    .map((item) =>
      sameId(item.id, id) ? { ...item, quantity: item.quantity - 1 } : item
    )
    .filter((item) => item.quantity > 0);

  writeCart(items);
}

export function removeCartItem(id: string | number) {
  const items = getCartItems().filter((item) => !sameId(item.id, id));
  writeCart(items);
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function clearCartByStore(storeId: string) {
  const items = getCartItems().filter((item) => item.storeId !== storeId);
  writeCart(items);
}

export function purgeLegacyCartItems() {
  const items = getCartItems().filter((item) => Boolean(item.storeId));
  writeCart(items);
}
