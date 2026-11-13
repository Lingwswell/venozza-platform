"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ROLE_LABELS, can, normalizeRole, type Role } from "@/lib/auth/roles";
import { useStockAlerts } from "@/components/admin/useStockAlerts";
import { useBillingStatus } from "@/components/admin/useBillingStatus";

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  platformAdmin?: boolean;
};

type MenuContext = { platformAdmin: boolean; needsOnboarding: boolean; features: Record<string, boolean> };

// Cada item aparece so para quem tem permissao (o servidor tambem confere).
const menu: { href: string; label: string; icon: string; show: (role: Role | null, ctx: MenuContext) => boolean }[] = [
  { href: "/admin/primeiros-passos", label: "Primeiros passos", icon: "🚀", show: (r, ctx) => can.manageStores(r) && ctx.needsOnboarding },
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊", show: can.operateStoreKds },
  { href: "/admin/monitor", label: "Monitor", icon: "🛰️", show: can.viewMonitor },
  { href: "/admin/pedidos", label: "Pedidos", icon: "🧾", show: can.operateStoreKds },
  { href: "/admin/kds", label: "KDS", icon: "🍳", show: can.operateStoreKds },
  { href: "/admin/produtos", label: "Produtos", icon: "🍕", show: can.operateStoreKds },
  { href: "/admin/categorias", label: "Categorias", icon: "🗂️", show: can.manageCatalog },
  { href: "/admin/opcoes", label: "Opções", icon: "🧩", show: can.manageCatalog },
  { href: "/admin/estoque", label: "Estoque", icon: "📦", show: (r, ctx) => can.viewStock(r) && ctx.features.estoque !== false },
  { href: "/admin/lojas", label: "Lojas", icon: "🏬", show: can.manageStores },
  { href: "/admin/usuarios", label: "Usuários", icon: "👤", show: can.manageUsers },
  { href: "/admin/financeiro", label: "Financeiro", icon: "💰", show: can.viewReports },
  { href: "/admin/marketing", label: "Marketing", icon: "📣", show: (r, ctx) => can.manageCatalog(r) && ctx.features.promocoes !== false },
  { href: "/admin/configuracoes", label: "Configurações", icon: "⚙️", show: can.openCloseStore },
  { href: "/admin/assinatura", label: "Assinatura", icon: "💳", show: can.manageStores },
  { href: "/admin/redes", label: "Redes (plataforma)", icon: "🌐", show: (r, ctx) => r === "super_admin" || ctx.platformAdmin },
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

  const role = normalizeRole(user?.role);
  const stockAlerts = useStockAlerts(ready && can.viewStock(role));
  const billing = useBillingStatus(ready);
  const menuCtx: MenuContext = {
    platformAdmin: Boolean(user?.platformAdmin || billing?.platformAdmin),
    needsOnboarding: Boolean(billing?.needsOnboarding),
    features: billing?.features || {},
  };

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
            {menu.filter((item) => item.show(role, menuCtx)).map((item) => {
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
                  {item.href === "/admin/estoque" && stockAlerts.count > 0 ? (
                    <span
                      className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white"
                      title={[
                        stockAlerts.central ? `${stockAlerts.central} pedido(s) para a central` : "",
                        stockAlerts.low ? `${stockAlerts.low} insumo(s) abaixo do mínimo` : "",
                        stockAlerts.toReceive ? `${stockAlerts.toReceive} envio(s) para receber` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      {stockAlerts.count}
                    </span>
                  ) : null}
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

                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#6d28d9)] text-xs font-bold text-white">
                    {initials.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {user?.name || "Admin"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {user?.email || ""} • {role ? ROLE_LABELS[role] : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="flex-1 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-5">
            <BillingBanner billing={billing} canManage={can.manageStores(role)} />
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

function BillingBanner({
  billing,
  canManage,
}: {
  billing: ReturnType<typeof useBillingStatus>;
  canManage: boolean;
}) {
  const state = billing?.state;
  if (!state || state.key === "active") return null;

  let text = "";
  let tone = "border-amber-200 bg-amber-50 text-amber-800";
  if (state.key === "trial") {
    if (state.daysLeft === null || state.daysLeft > 5) return null;
    text = `Seu período de teste acaba em ${state.daysLeft} dia(s). Ative a cobrança para não parar de vender.`;
  } else if (state.key === "past_due" || state.key === "trial_expired") {
    text = state.blocked
      ? "Pedidos pelo site e pelo app estão pausados por falta de pagamento."
      : `Pagamento pendente. Os pedidos online param em ${state.daysLeft} dia(s) se não for pago.`;
    tone = state.blocked ? "border-rose-200 bg-rose-50 text-rose-800" : tone;
  } else if (state.key === "suspended" || state.key === "canceled") {
    text = "Esta rede está suspensa: o site e o app não recebem pedidos. Fale com o suporte.";
    tone = "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (!text) return null;

  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${tone}`}>
      <span>{text}</span>
      {canManage ? (
        <Link href="/admin/assinatura" className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm">
          Ver assinatura
        </Link>
      ) : null}
    </div>
  );
}
