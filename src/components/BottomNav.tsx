"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, ShoppingBag, User, Plus } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface BottomNavProps {
  cartCount?: number;
}

export default function BottomNav({ cartCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const lastScrollY = useRef(0);

  const navItems = [
    { 
      name: "Home", 
      href: "/m", 
      icon: Home,
      showPlus: false 
    },
    { 
      name: "Menu", 
      href: "/m#pizzas", 
      icon: Menu, 
      hash: true,
      showPlus: true 
    },
    { 
      name: "Pedido", 
      href: "/m/checkout", 
      icon: ShoppingBag,
      showPlus: false 
    },
    { 
      name: "Conta", 
      href: "/m/conta", 
      icon: User,
      showPlus: true 
    },
  ];

  const isActive = (href: string, hash?: boolean) => {
    if (hash) return pathname === "/m";
    return pathname === href;
  };

  useEffect(() => {
    setMounted(true);

    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking && typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY > 200 && currentScrollY > lastScrollY.current + 50) {
            setScrollY(currentScrollY);
          } else {
            setScrollY(0);
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window?.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (!mounted) return null;

  const isNearBottom = scrollY > (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 0);
  const shouldHide = scrollY > 200 && !isNearBottom;

  return (
    <>
      {shouldHide && <div className="fixed inset-0 z-40" />}
      
      <nav 
        className={`fixed bottom-4 left-4 right-4 z-50 transition-all duration-300 ease-out ${
          shouldHide ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-md overflow-hidden rounded-3xl bg-gradient-to-r from-white/95 to-white/90 p-1 shadow-2xl backdrop-blur-xl border border-white/50">
          <div className="rounded-[22px] bg-gradient-to-r from-orange-50/80 via-white/90 to-pink-50/80 shadow-xl">
            <div className="mx-auto flex max-w-md items-center justify-around px-6 py-4">
              {navItems.map((item) => {
                const active = isActive(item.href, item.hash);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    scroll={item.hash ? false : true}
                    className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-4 py-2 transition-all duration-200 hover:bg-white/60 active:scale-[0.97] hover:shadow-md"
                  >
                    <div className="relative flex h-14 w-14 items-center justify-center">
                      {/* Fundo animado */}
                      <div 
                        className={`absolute inset-0 rounded-2xl transition-all duration-200 ${
                          active 
                            ? 'bg-gradient-to-br from-orange-400/20 to-pink-400/20 shadow-lg scale-105' 
                            : 'bg-transparent group-hover:bg-orange-100/50'
                        }`}
                      />
                      
                      {/* Ícone principal */}
                      <Icon
                        size={26}
                        strokeWidth={active ? 2.5 : 1.8}
                        className={`z-10 transition-all duration-200 ${
                          active 
                            ? "text-orange-500 drop-shadow-lg" 
                            : "text-gray-600 group-hover:text-gray-800"
                        }`}
                      />
                      
                      {/* ✅ BOTÃO + nos itens certos */}
                      {item.showPlus && (
                        <div className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-full bg-orange-500 shadow-lg flex items-center justify-center group-hover:scale-110 transition-all duration-200">
                          <Plus size={14} className="text-white font-bold" />
                        </div>
                      )}
                      
                      {/* Badge carrinho */}
                      {item.name === "Pedido" && cartCount > 0 && (
                        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-[11px] font-black text-white shadow-lg ring-2 ring-white">
                          {cartCount > 99 ? "99+" : cartCount}
                        </div>
                      )}
                      
                      {/* Indicador ativo */}
                      {active && (
                        <div className="absolute -bottom-2 h-3 w-3 rounded-full bg-orange-500 shadow-lg animate-pulse" />
                      )}
                    </div>

                    <span 
                      className={`text-xs font-bold transition-all duration-200 ${
                        active 
                          ? "text-orange-500 translate-y-[-2px] scale-110" 
                          : "text-gray-600 group-hover:scale-105"
                      }`}
                    >
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}