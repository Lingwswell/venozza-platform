"use client";

import AdminShell from "@/components/admin/AdminShell";

type WeekDayConfig = {
  day: string;
  open: string;
  close: string;
  active: boolean;
};

const weekDays: WeekDayConfig[] = [
  { day: "Segunda-feira", open: "18:00", close: "23:00", active: true },
  { day: "Terça-feira", open: "18:00", close: "23:00", active: true },
  { day: "Quarta-feira", open: "18:00", close: "23:00", active: true },
  { day: "Quinta-feira", open: "18:00", close: "23:00", active: true },
  { day: "Sexta-feira", open: "18:00", close: "00:00", active: true },
  { day: "Sábado", open: "18:00", close: "00:00", active: true },
  { day: "Domingo", open: "18:00", close: "23:00", active: true },
];

const paymentMethods = [
  { label: "PIX", enabled: true, description: "Pagamento instantâneo" },
  { label: "Dinheiro", enabled: true, description: "Receber na entrega" },
  { label: "Cartão de crédito", enabled: false, description: "Futuro módulo TEF/maquininha" },
  { label: "Cartão de débito", enabled: false, description: "Futuro módulo TEF/maquininha" },
];

const nextSteps = [
  {
    step: "71.3",
    title: "Definir schema StoreSettings",
    description:
      "Criar estrutura separada para configurações operacionais da loja.",
  },
  {
    step: "71.4",
    title: "API Admin Configurações",
    description:
      "Permitir carregar e salvar status, horários, frete, WhatsApp e pagamentos.",
  },
  {
    step: "71.5",
    title: "Mobile lendo configurações",
    description:
      "Checkout e /m passam a respeitar loja aberta, frete, pagamento e retirada.",
  },
];

export default function Page() {
  return (
    <AdminShell
      title="Configurações"
      subtitle="Configurações operacionais da loja e regras de atendimento."
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
                VenoZza Admin
              </p>
              <h3 className="mt-2 text-3xl font-black text-slate-900">
                Configurações da loja
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                MVP visual para validar as regras operacionais de cada loja:
                funcionamento, entrega, retirada, frete, WhatsApp e formas de
                pagamento. Nesta etapa ainda não há persistência no banco.
              </p>
            </div>

            <button
              type="button"
              disabled
              className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
              title="Será ativado quando a API de configurações for criada"
            >
              Salvar configurações
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">
              Status da loja
            </p>
            <strong className="mt-2 block text-2xl text-emerald-900">
              Aberta
            </strong>
            <p className="mt-2 text-xs text-emerald-700">
              Controle manual futuro
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Tempo de preparo
            </p>
            <strong className="mt-2 block text-2xl text-slate-900">
              35 min
            </strong>
            <p className="mt-2 text-xs text-slate-400">
              Usado no mobile e KDS futuramente
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Frete base</p>
            <strong className="mt-2 block text-2xl text-slate-900">
              R$ 5,00
            </strong>
            <p className="mt-2 text-xs text-slate-400">
              Hoje o checkout usa valor fixo
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Pedido mínimo
            </p>
            <strong className="mt-2 block text-2xl text-slate-900">
              R$ 20,00
            </strong>
            <p className="mt-2 text-xs text-slate-400">
              Regra futura por loja
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black text-slate-900">
              Operação da loja
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Regras principais que futuramente serão salvas por loja.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900">Aceitar entrega</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Permite pedidos com endereço e frete.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Ativo
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900">Aceitar retirada</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cliente pode retirar no balcão.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Ativo
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-bold text-slate-900">WhatsApp da loja</p>
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
                  (11) 99999-9999
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Futuro canal para atendimento e campanhas.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-bold text-slate-900">Raio de entrega</p>
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  5 km
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  O schema Store já possui deliveryRadiusKm.
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black text-slate-900">
              Formas de pagamento
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Esta seção define quais pagamentos aparecem no checkout.
            </p>

            <div className="mt-5 space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.label}
                  className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4"
                >
                  <div>
                    <p className="font-bold text-slate-900">{method.label}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {method.description}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      method.enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {method.enabled ? "Ativo" : "Inativo"}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Horário de funcionamento
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Modelo visual para regras semanais por loja.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              Dados demonstrativos
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Dia</th>
                  <th className="px-3 py-3">Abertura</th>
                  <th className="px-3 py-3">Fechamento</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map((item) => (
                  <tr key={item.day} className="border-b border-slate-100">
                    <td className="px-3 py-4 font-bold text-slate-900">
                      {item.day}
                    </td>
                    <td className="px-3 py-4 text-slate-700">{item.open}</td>
                    <td className="px-3 py-4 text-slate-700">{item.close}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.active ? "Aberto" : "Fechado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
          <h3 className="text-xl font-black text-orange-950">
            Próximas etapas recomendadas
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-orange-800">
            Depois que o desenho visual estiver aprovado, o próximo passo é
            criar a estrutura real de configurações por loja e fazer o mobile
            respeitar essas regras.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {nextSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-orange-200 bg-white/70 p-4"
              >
                <p className="text-sm font-black text-orange-600">
                  {item.step}
                </p>
                <h4 className="mt-1 font-bold text-slate-900">
                  {item.title}
                </h4>
                <p className="mt-2 text-sm text-slate-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
