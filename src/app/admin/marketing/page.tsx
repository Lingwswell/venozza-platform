"use client";

import AdminShell from "@/components/admin/AdminShell";

type CampaignStatus = "Ativa" | "Planejada" | "Pausada";

type Campaign = {
  name: string;
  channel: string;
  type: string;
  status: CampaignStatus;
  goal: string;
  coupon: string;
  period: string;
  budget: string;
  expectedResult: string;
};

const campaigns: Campaign[] = [
  {
    name: "Combo Família",
    channel: "Instagram + WhatsApp",
    type: "Orgânico",
    status: "Ativa",
    goal: "Vender pizzas família no jantar",
    coupon: "FAMILIA10",
    period: "Hoje até domingo",
    budget: "R$ 0,00",
    expectedResult: "Aumentar pedidos no horário de pico",
  },
  {
    name: "Primeira Compra",
    channel: "Google + Link direto",
    type: "Tráfego pago",
    status: "Planejada",
    goal: "Trazer novos clientes para o /m",
    coupon: "BEMVINDO15",
    period: "Próxima semana",
    budget: "R$ 30,00/dia",
    expectedResult: "Gerar novos cadastros e pedidos",
  },
  {
    name: "Batata + Refrigerante",
    channel: "WhatsApp",
    type: "Lista de transmissão",
    status: "Planejada",
    goal: "Vender acompanhamentos junto com pizzas",
    coupon: "COMBOBATATA",
    period: "Sexta-feira",
    budget: "R$ 0,00",
    expectedResult: "Aumentar ticket médio",
  },
];

const channels = [
  {
    name: "Instagram",
    description: "Posts, stories, reels e anúncios locais.",
    icon: "📸",
    focus: "Topo de funil e desejo",
  },
  {
    name: "WhatsApp",
    description: "Campanhas para clientes que já compraram.",
    icon: "💬",
    focus: "Recorrência e relacionamento",
  },
  {
    name: "Google",
    description: "Busca por pizzaria, delivery e promoções na região.",
    icon: "🔎",
    focus: "Intenção de compra",
  },
  {
    name: "Cupons",
    description: "Rastrear campanhas por códigos promocionais.",
    icon: "🎟️",
    focus: "Medição de resultado",
  },
];

function getStatusClass(status: CampaignStatus) {
  switch (status) {
    case "Ativa":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Planejada":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Pausada":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export default function Page() {
  return (
    <AdminShell
      title="Marketing"
      subtitle="Planejamento de campanhas, canais e ações para crescimento das lojas."
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                VenoZza Admin
              </p>
              <h3 className="mt-2 text-3xl font-black text-slate-900">
                Central de marketing
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                MVP visual para planejar campanhas orgânicas, tráfego pago,
                cupons e ações de recorrência. Nesta etapa ainda não existe
                persistência no banco; o objetivo é validar o desenho do módulo.
              </p>
            </div>

            <button
              type="button"
              disabled
              className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
              title="Será ativado quando a API de campanhas for criada"
            >
              + Nova campanha
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Campanhas ativas
            </p>
            <strong className="mt-2 block text-3xl text-slate-900">1</strong>
            <p className="mt-2 text-xs text-slate-400">MVP visual</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Campanhas planejadas
            </p>
            <strong className="mt-2 block text-3xl text-slate-900">2</strong>
            <p className="mt-2 text-xs text-slate-400">Próximas ações</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Canais mapeados
            </p>
            <strong className="mt-2 block text-3xl text-slate-900">4</strong>
            <p className="mt-2 text-xs text-slate-400">
              Instagram, WhatsApp, Google e cupons
            </p>
          </div>

          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-orange-700">
              Próximo passo
            </p>
            <strong className="mt-2 block text-lg text-orange-900">
              Criar schema real
            </strong>
            <p className="mt-2 text-xs text-orange-700">
              MarketingCampaign + vínculo com pedido/cupom
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Campanhas planejadas
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Exemplo de como o módulo pode organizar ações comerciais.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                Dados demonstrativos
              </span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3">Campanha</th>
                    <th className="px-3 py-3">Canal</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Cupom</th>
                    <th className="px-3 py-3">Período</th>
                    <th className="px-3 py-3">Orçamento</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.name} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <div className="font-bold text-slate-900">
                          {campaign.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {campaign.goal}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        {campaign.channel}
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        {campaign.type}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClass(
                            campaign.status
                          )}`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
                          {campaign.coupon}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        {campaign.period}
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-900">
                        {campaign.budget}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black text-slate-900">
              Como medir resultado
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              A primeira versão real deve medir campanhas usando cupom, link e
              período. Assim o lojista sabe quais ações geram pedidos.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">1. Cupom</p>
                <p className="mt-1 text-sm text-slate-500">
                  Cada campanha usa um código para rastrear vendas.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">2. Link</p>
                <p className="mt-1 text-sm text-slate-500">
                  Link com campanha para divulgar no Instagram, Google ou WhatsApp.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">3. Pedido</p>
                <p className="mt-1 text-sm text-slate-500">
                  O pedido salva cupom/campanha para gerar relatório.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {channels.map((channel) => (
            <div
              key={channel.name}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="text-3xl">{channel.icon}</div>
              <h4 className="mt-3 text-lg font-black text-slate-900">
                {channel.name}
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {channel.description}
              </p>
              <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                Foco: {channel.focus}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">
            Próximas etapas recomendadas
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-black text-orange-600">67.3</p>
              <h4 className="mt-1 font-bold text-slate-900">
                Definir schema MarketingCampaign
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                Criar estrutura de campanha por tenant/loja.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-black text-orange-600">67.4</p>
              <h4 className="mt-1 font-bold text-slate-900">
                API Admin Marketing
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                Listar, criar, editar, pausar e finalizar campanhas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-black text-orange-600">67.5</p>
              <h4 className="mt-1 font-bold text-slate-900">
                Vincular campanha ao pedido
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                Medir pedidos, faturamento e ticket médio por campanha.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
