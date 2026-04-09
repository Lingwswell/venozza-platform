"use client";

import AdminShell from "@/components/admin/AdminShell";

export default function Page() {
  return (
    <AdminShell
      title="Pedidos"
      subtitle="Módulo em preparação no ambiente de desenvolvimento."
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          VenoZza Admin
        </p>
        <h3 className="mt-2 text-3xl font-black text-slate-900">
          Página de pedidos
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-slate-500">
          Essa área será evoluída em breve com dados reais, filtros, tabelas e ações operacionais.
        </p>
      </div>
    </AdminShell>
  );
}
