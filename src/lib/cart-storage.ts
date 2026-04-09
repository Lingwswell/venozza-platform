import type { CartItem } from "@/types/order";
import { parseMoneyStringToCents } from "@/lib/utils/formatters";

const STORAGE_KEY = "venozza_cart";

type LegacyCartItem = CartItem & {
  price?: number | string;
};

function readCart(): LegacyCartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeItem(item: LegacyCartItem): CartItem {
  let price_cents = 0;

  if (typeof item.price_cents === "number" && Number.isFinite(item.price_cents)) {
    price_cents = item.price_cents;
  } else if (typeof item.price === "number" && Number.isFinite(item.price)) {
    price_cents = Math.round(item.price * 100);
  } else if (typeof item.price === "string") {
    price_cents = parseMoneyStringToCents(item.price);
  }

  return {
    id: Number(item.id || 0),
    name: String(item.name || ""),
    quantity: Number(item.quantity || 1),
    price_cents,
    image: item.image || "",
    note: item.note || "",
    addons: Array.isArray(item.addons) ? item.addons : [],
    size: item.size || "",
    crust: item.crust || "",
  };
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getCartItems(): CartItem[] {
  return readCart()
    .map(normalizeItem)
    .filter(
      (item) =>
        Number.isFinite(item.id) &&
        item.id > 0 &&
        item.name.length > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );
}

export function getCartCount() {
  return getCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function getCartSubtotal() {
  return getCartItems().reduce(
    (sum, item) => sum + Number(item.price_cents || 0) * Number(item.quantity || 0),
    0
  );
}

export function addToCart(item: Omit<CartItem, "quantity"> & { quantity?: number; price?: number | string }) {
  const items = getCartItems();

  const normalized = normalizeItem({
    ...item,
    quantity: Number(item.quantity || 1),
  });

  const index = items.findIndex(
    (current) =>
      current.id === normalized.id &&
      current.name === normalized.name &&
      JSON.stringify(current.addons || []) === JSON.stringify(normalized.addons || []) &&
      String(current.note || "") === String(normalized.note || "")
  );

  if (index >= 0) {
    items[index].quantity += normalized.quantity;
  } else {
    items.push(normalized);
  }

  writeCart(items);
}

export function incrementCartItem(id: number) {
  const items = getCartItems().map((item) =>
    item.id === id ? { ...item, quantity: item.quantity + 1 } : item
  );
  writeCart(items);
}

export function decrementCartItem(id: number) {
  const items = getCartItems()
    .map((item) =>
      item.id === id ? { ...item, quantity: item.quantity - 1 } : item
    )
    .filter((item) => item.quantity > 0);

  writeCart(items);
}

export function removeCartItem(id: number) {
  const items = getCartItems().filter((item) => item.id !== id);
  writeCart(items);
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
