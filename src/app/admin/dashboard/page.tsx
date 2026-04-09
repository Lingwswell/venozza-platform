"use client";

import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";

const summaryCards = [
  { label: "Pedidos hoje", value: "128", hint: "+12% vs ontem", icon: "🧾" },
  { label: "Faturamento", value: "R$ 4.860", hint: "Meta do dia: R$ 7.000", icon: "💰" },
  { label: "Ticket médio", value: "R$ 37,97", hint: "Com base em pedidos do dia", icon: "📈" },
  { label: "Lojas ativas", value: "3", hint: "Operando no ambiente", icon: "🏬" },
];

const quickModules = [
  {
    title: "Pedidos",
    desc: "Acompanhe pedidos em andamento, atrasos e fluxo operacional.",
    href: "/admin/pedidos",
    icon: "🧾",
  },
  {
    title: "Produtos",
    desc: "Gerencie catálogo, preços, disponibilidade e categorias.",
    href: "/admin/produtos",
    icon: "🍕",
  },
  {
    title: "Financeiro",
    desc: "Veja indicadores, fechamento e visão de receita.",
    href: "/admin/financeiro",
    icon: "💰",
  },
  {
    title: "Lojas",
    desc: "Centralize unidades, operação e expansão multi-loja.",
    href: "/admin/lojas",
    icon: "🏬",
  },
];

export default function AdminDashboardPage() {
  return (
    <AdminShell
      title="Dashboard profissional"
      subtitle="Visão executiva da operação VenoZza no ambiente de desenvolvimento."
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                  Visão geral
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  Centro de comando da operação
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Essa área será a base para pedidos, expedição, financeiro, multi-loja,
                  catálogo, campanhas e monitoramento operacional.
                </p>
              </div>

              <div className="hidden rounded-3xl bg-slate-900 px-5 py-4 text-white lg:block">
                <p className="text-xs uppercase tracking-[0.25em] text-orange-300">
                  Status
                </p>
                <p className="mt-2 text-lg font-bold">Operação monitorada</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {quickModules.map((module) => (
                <Link
                  key={module.title}
                  href={module.href}
                  className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-orange-300 hover:bg-orange-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl">{module.icon}</p>
                      <h4 className="mt-3 text-lg font-black text-slate-900">
                        {module.title}
                      </h4>
                      <p className="mt-2 text-sm text-slate-500">{module.desc}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm group-hover:text-orange-600">
                      Abrir
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                Prioridades
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-900">
                Próximos passos do admin
              </h3>

              <div className="mt-5 space-y-4">
                {[
                  "Criar módulos reais de pedidos e catálogo",
                  "Implementar menu lateral com páginas funcionais",
                  "Ligar métricas reais do banco",
                  "Preparar base multi-loja e permissões",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <span className="mt-0.5 text-orange-600">●</span>
                    <p className="text-sm text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#1e293b,#0f172a)] p-6 text-white shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">
                Ambiente atual
              </p>
              <h3 className="mt-2 text-2xl font-black">Desenvolvimento</h3>
              <p className="mt-3 text-sm text-slate-300">
                Todas as alterações estão sendo trabalhadas apenas no DEV,
                sem impactar produção.
              </p>
              <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200">
                URL base: http://192.168.15.15:3001
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
