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
    router.replace("/admin/login");
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] flex items-center justify-center">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-sm border border-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-600">
            Admin VenoZza
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">
            Validando sessão...
          </h1>
          <p className="mt-2 text-slate-500">
            Aguarde enquanto carregamos o ambiente administrativo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-[#0f172a] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-orange-400">
              VenoZza
            </p>
            <h1 className="mt-2 text-2xl font-black">Admin Central</h1>
            <p className="mt-2 text-sm text-slate-300">
              Painel operacional da plataforma
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-4">
            {menu.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-orange-500 text-white shadow"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Sair do painel
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-600">
                  Admin VenoZza
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:block">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ambiente
                  </p>
                  <p className="text-sm font-bold text-slate-900">DEV • porta 3001</p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#6d28d9)] text-sm font-bold text-white">
                    {initials.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {user?.name || "Admin"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user?.email || "admin@venozza.com"} • {user?.role || "SUPER_ADMIN"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="flex-1 px-5 py-6 sm:px-6 lg:px-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
