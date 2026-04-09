"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart-storage";

export default function DebugCartPage() {
  useEffect(() => {
    clearCart();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Carrinho limpo com sucesso.</h1>
    </main>
  );
}
