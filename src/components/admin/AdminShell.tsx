"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "🧾" },
  { href: "/admin/kds", label: "KDS", icon: "🍳" },
  { href: "/admin/produtos", label: "Produtos", icon: "🍕" },
  { href: "/admin/lojas", label: "Lojas", icon: "🏬" },
  { href: "/admin/financeiro", label: "Financeiro", icon: "💰" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥" },
  { href: "/admin/marketing", label: "Marketing", icon: "📣" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "⚙️" },
];

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token =
      localStorage.getItem("venozza_token") ||
      sessionStorage.getItem("venozza_token");

    const rawUser =
      localStorage.getItem("venozza_user") ||
      sessionStorage.getItem("venozza_user");

    if (!token || !rawUser) {
      router.replace("/admin/login");
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as StoredUser;
      setUser(parsed);
      setReady(true);
    } catch {
      localStorage.removeItem("venozza_token");
      localStorage.removeItem("venozza_user");
      sessionStorage.removeItem("venozza_token");
      sessionStorage.removeItem("venozza_user");
    document.cookie = "venozza_token=; path=/; max-age=0; SameSite=Lax";
      router.replace("/admin/login");
    }
  }, [router]);

  const initials = useMemo(() => {
    const name = user?.name?.trim() || "Admin";
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "A") + (parts[1]?.[0] || "");
  }, [user]);

  function handleLogout() {
    localStorage.removeItem("venozza_token");
    localStorage.removeItem("venozza_user");
    sessionStorage.removeItem("venozza_token");
    sessionStorage.removeItem("venozza_user");
    document.cookie = "venozza_token=; path=/; max-age=0; SameSite=Lax";
    router.replace("/admin/login");
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">
            Admin VenoZza
          </p>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Validando sessão...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="flex min-h-screen">
        {menuOpen ? (
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        ) : null}

        <aside
          className={[
            "fixed z-50 h-full w-64 bg-[#0f172a] text-white transition-transform lg:static lg:translate-x-0",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-orange-400">
              VenoZza
            </p>
            <h1 className="mt-1 text-xl font-black">Admin Central</h1>
            <p className="mt-1 text-xs text-slate-300">
              Operação da plataforma
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-3">
            {menu.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition",
                    active
                      ? "bg-orange-500 text-white shadow"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <button
              onClick={handleLogout}
              className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Sair do painel
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="mt-0.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-lg lg:hidden"
                >
                  ☰
                </button>

                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-600">
                    Admin VenoZza
                  </p>
                  <h2 className="mt-0.5 truncate text-2xl font-black tracking-tight text-slate-900">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 lg:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Ambiente
                  </p>
                  <p className="text-xs font-bold text-slate-900">DEV • porta 3000</p>
                </div>

                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#6d28d9)] text-xs font-bold text-white">
                    {initials.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {user?.name || "Admin"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {user?.email || "admin@venozza.com"} • {user?.role || "SUPER_ADMIN"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="flex-1 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-5">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
