"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product } from "@/types/product";

type Mode = "delivery" | "retirada";

type CartContextType = {
  items: CartItem[];
  cartOpen: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  qtyOf: (id: number) => number;
  totalItems: number;
  subtotal: number;
  freight: number;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "venozza_cart_v1";
const MODE_KEY = "venozza_mode_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mode, setModeState] = useState<Mode>("delivery");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const rawCart = localStorage.getItem(STORAGE_KEY);
      const rawMode = localStorage.getItem(MODE_KEY);

      if (rawCart) setItems(JSON.parse(rawCart));
      if (rawMode === "delivery" || rawMode === "retirada") {
        setModeState(rawMode);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {}
  }, [mode]);

  function setMode(modeValue: Mode) {
    setModeState(modeValue);
  }

  function openCart() {
    setCartOpen(true);
  }

  function closeCart() {
    setCartOpen(false);
  }

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [
        ...prev,
        {
          id: product.id,
          nome: product.nome,
          preco: product.preco,
          qty: 1,
          image: product.image,
        },
      ];
    });
  }

  function removeItem(id: number) {
    setItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0)
    );
  }

  function clearCart() {
    setItems([]);
  }

  function qtyOf(id: number) {
    return items.find((item) => item.id === id)?.qty ?? 0;
  }

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.preco ?? item.price ?? 0) * item.qty, 0),
    [items]
  );

  const freight = mode === "retirada" ? 0 : 8.99;
  const total = subtotal + freight;

  const value = useMemo<CartContextType>(
    () => ({
      items,
      cartOpen,
      mode,
      setMode,
      openCart,
      closeCart,
      addItem,
      removeItem,
      clearCart,
      qtyOf,
      totalItems,
      subtotal,
      freight,
      total,
    }),
    [items, cartOpen, mode, totalItems, subtotal, freight, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
