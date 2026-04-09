"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Menu, ShoppingCart, User, ClipboardList } from "lucide-react";
import { getCartCount } from "@/lib/cart-storage";

function navItemClass(active: boolean) {
  return [
    "flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-all",
    active ? "text-red-600" : "text-neutral-500",
  ].join(" ");
}

function iconWrapClass(active: boolean) {
  return [
    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all",
    active ? "bg-red-50 text-red-600" : "text-neutral-500",
  ].join(" ");
}

export default function AppBottomNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const reload = () => setCartCount(getCartCount());

    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("storage", reload);

    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const isHome = pathname === "/m";
  const isMenu = pathname.startsWith("/m/produto") || pathname.startsWith("/m/categoria");
  const isCart = pathname === "/m/carrinho" || pathname === "/m/checkout";
  const isProfile = pathname === "/m/perfil" || pathname === "/m/conta";
  const isOrders = pathname === "/m/pedidos" || pathname.startsWith("/m/pedido/");

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2">
      <div className="relative rounded-[28px] border border-white/70 bg-white/95 px-5 pb-4 pt-5 shadow-[0_12px_35px_rgba(0,0,0,0.12)] backdrop-blur">
        <div className="grid grid-cols-5 items-end">
          <Link href="/m" className={navItemClass(isHome)}>
            <div className={iconWrapClass(isHome)}>
              <Home size={22} strokeWidth={2.2} />
            </div>
            <span>Início</span>
          </Link>

          <Link href="/m#menu" className={navItemClass(isMenu)}>
            <div className={iconWrapClass(isMenu)}>
              <Menu size={22} strokeWidth={2.2} />
            </div>
            <span>Menu</span>
          </Link>

          <Link
            href="/m/carrinho"
            className="relative flex flex-col items-center justify-end text-xs font-semibold text-neutral-500"
          >
            <div className="-mt-11 flex h-20 w-20 items-center justify-center rounded-full border-[6px] border-white bg-red-600 text-white shadow-[0_14px_30px_rgba(239,68,68,0.35)] transition-transform active:scale-95">
              <ShoppingCart size={30} strokeWidth={2.4} />
            </div>

            {cartCount > 0 ? (
              <span className="absolute right-3 top-[-6px] flex min-h-7 min-w-7 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-extrabold text-white shadow-md">
                {cartCount}
              </span>
            ) : null}

            <span className="mt-1 opacity-0 select-none">Carrinho</span>
          </Link>

          <Link href="/m/perfil" className={navItemClass(isProfile)}>
            <div className={iconWrapClass(isProfile)}>
              <User size={22} strokeWidth={2.2} />
            </div>
            <span>Perfil</span>
          </Link>

          <Link href="/m/pedidos" className={navItemClass(isOrders)}>
            <div className={iconWrapClass(isOrders)}>
              <ClipboardList size={22} strokeWidth={2.2} />
            </div>
            <span>Pedidos</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
