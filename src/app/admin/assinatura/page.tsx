"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { BILLING_LABELS, type BillingState, type MonthlyBreakdown } from "@/lib/billing/state";

// Assinatura da rede (dono): plano, valor, faturas e ativacao da cobranca.

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  maxStores: number | null;
  extraStorePriceCents: number | null;
  description: string | null;
};
type AddonOption = { id: string; name: string; description: string | null; priceCents: number; contracted: boolean };
type Invoice = {
  id: string;
  amountCents: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  invoiceUrl: string | null;
  billingType: string | null;
  description: string | null;
  kind: string;
};
type Data = {
  name: string;
  state: BillingState;
  trialEndsAt: string | null;
  plan: Plan | null;
  plans: Plan[];
  stores: number;
  monthlyCents: number | null;
  breakdown: MonthlyBreakdown | null;
  addons: AddonOption[];
  asaas: boolean;
  hasSubscription: boolean;
  billing: { name: string | null; email: string | null; document: string | null };
  invoices: Invoice[];
};

const INVOICE_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "Em aberto", className: "bg-amber-100 text-amber-700" },
  paid: { text: "Paga", className: "bg-emerald-100 text-emerald-700" },
  overdue: { text: "Vencida", className: "bg-rose-100 text-rose-700" },
  canceled: { text: "Cancelada", className: "bg-slate-100 text-slate-500" },
  refunded: { text: "Estornada", className: "bg-slate-100 text-slate-500" },
};

const input = "w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-orange-400";
const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
const primary = "rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

export default function AssinaturaPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", document: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/billing");
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar a assinatura.");
      setData(json);
      setForm((f) => ({
        name: f.name || json.billing.name || json.name || "",
        email: f.email || json.billing.email || "",
        document: f.document,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a assinatura.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar.");
      setSuccess(done);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const s = data?.state;
  const openInvoice = data?.invoices.find((i) => (i.status === "pending" || i.status === "overdue") && i.invoiceUrl);

  return (
    <AdminShell title="Assinatura" subtitle="Seu plano, o valor do mês e as faturas.">
      <div className="flex flex-col gap-5">
        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {!data ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className={card}>
                <p className="text-xs font-bold text-slate-500">Situação</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{s ? BILLING_LABELS[s.key] : "—"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {s?.key === "trial" && data.trialEndsAt ? `Teste até ${date(data.trialEndsAt)}.` : null}
                  {s?.blocked ? "Pedidos online pausados até o pagamento." : null}
                  {!s?.blocked && (s?.key === "past_due" || s?.key === "trial_expired")
                    ? `Pague em até ${s.daysLeft} dia(s) para não pausar os pedidos.`
                    : null}
                </p>
                {openInvoice ? (
                  <a href={openInvoice.invoiceUrl!} target="_blank" rel="noreferrer" className={`${primary} mt-3 inline-block`}>
                    Pagar fatura de {money(openInvoice.amountCents)}
                  </a>
                ) : null}
              </div>
              <div className={card}>
                <p className="text-xs font-bold text-slate-500">Plano</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{data.plan?.name || "Sem plano"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {!data.plan
                    ? "Fale com o suporte."
                    : data.plan.extraStorePriceCents !== null
                      ? `${money(data.plan.priceCents)}/mês com ${data.plan.maxStores || 1} loja(s). Loja extra: ${money(data.plan.extraStorePriceCents)}/mês.`
                      : `${money(data.plan.priceCents)} por loja ativa, por mês.`}
                </p>
              </div>
              <div className={card}>
                <p className="text-xs font-bold text-slate-500">Valor do mês</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{data.monthlyCents !== null ? money(data.monthlyCents) : "—"}</p>
                <p className="mt-1 text-sm text-slate-600">{data.stores} loja(s) ativa(s). Abriu ou fechou loja, o valor acompanha.</p>
                {data.breakdown && (data.breakdown.extraCents > 0 || data.breakdown.addonsCents > 0) ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                    <li>Plano: {money(data.breakdown.baseCents)}</li>
                    {data.breakdown.extraCents > 0 ? (
                      <li>
                        {data.breakdown.extraStores} loja(s) extra: {money(data.breakdown.extraCents)}
                      </li>
                    ) : null}
                    {data.breakdown.addonsCents > 0 ? <li>Adicionais: {money(data.breakdown.addonsCents)}</li> : null}
                  </ul>
                ) : null}
              </div>
            </section>

            {data.plans.length > 1 ? (
              <section className={card}>
                <h3 className="text-base font-black text-slate-900">Planos</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {data.plans.map((p) => {
                    const current = p.id === data.plan?.id;
                    return (
                      <div key={p.id} className={`rounded-2xl border p-4 ${current ? "border-orange-400 bg-orange-50" : "border-slate-200"}`}>
                        <p className="font-black text-slate-900">{p.name}</p>
                        <p className="text-lg font-black text-slate-900">
                          {money(p.priceCents)}{" "}
                          <span className="text-xs font-semibold text-slate-500">{p.extraStorePriceCents !== null ? "/mês" : "/loja/mês"}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{p.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {p.extraStorePriceCents !== null
                            ? `${p.maxStores || 1} loja(s) incluída(s) · extra ${money(p.extraStorePriceCents)}/mês`
                            : p.maxStores
                              ? `Até ${p.maxStores} loja(s)`
                              : "Lojas ilimitadas"}
                        </p>
                        {current ? (
                          <p className="mt-2 text-xs font-bold text-orange-700">Seu plano</p>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => post({ action: "change_plan", planId: p.id }, `Plano trocado para ${p.name}.`)}
                            className="mt-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Mudar para este
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {data.addons.length > 0 && data.plan ? (
              <section className={card}>
                <h3 className="text-base font-black text-slate-900">Adicionais</h3>
                <p className="mt-1 text-sm text-slate-600">Ligue o que quiser usar. O valor entra na próxima mensalidade.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {data.addons.map((a) => (
                    <div key={a.id} className={`rounded-2xl border p-4 ${a.contracted ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">{a.name}</p>
                          <p className="text-sm text-slate-600">{a.description}</p>
                        </div>
                        <p className="shrink-0 font-black text-slate-900">
                          {money(a.priceCents)}
                          <span className="text-xs font-semibold text-slate-500">/mês</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (a.contracted && !window.confirm(`Cancelar ${a.name}? O recurso sai do painel.`)) return;
                          post(
                            { action: "toggle_addon", addonId: a.id, enabled: !a.contracted },
                            a.contracted ? `${a.name} cancelado.` : `${a.name} contratado. Já está liberado no painel.`
                          );
                        }}
                        className={
                          a.contracted
                            ? "mt-3 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white"
                            : `${primary} mt-3`
                        }
                      >
                        {a.contracted ? "Cancelar" : "Contratar"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {data.asaas && !data.hasSubscription && data.plan ? (
              <section className={`${card} border-orange-200`}>
                <h3 className="text-base font-black text-slate-900">Ativar cobrança</h3>
                <p className="mt-1 text-sm text-slate-600">
                  A fatura chega todo mês por e-mail e pode ser paga com Pix, boleto ou cartão.
                  {data.trialEndsAt && s?.key === "trial" ? ` A primeira vence no fim do teste (${date(data.trialEndsAt)}).` : ""}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <input className={input} placeholder="Nome ou razão social" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className={input} placeholder="E-mail para as faturas" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className={input} placeholder="CPF ou CNPJ" inputMode="numeric" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => post({ action: "activate", ...form }, "Cobrança ativada. A fatura aparece aqui e chega no seu e-mail.")}
                  className={`${primary} mt-3`}
                >
                  {busy ? "Ativando..." : "Ativar cobrança"}
                </button>
              </section>
            ) : null}

            {!data.asaas ? (
              <p className={`${card} text-sm text-slate-600`}>
                O pagamento desta rede é combinado direto com a plataforma. Quando ele for registrado, a situação acima muda sozinha.
              </p>
            ) : null}

            <section className={card}>
              <h3 className="text-base font-black text-slate-900">Faturas</h3>
              {data.invoices.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nenhuma fatura ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {data.invoices.map((i) => {
                    const st = INVOICE_LABEL[i.status] || { text: i.status, className: "bg-slate-100 text-slate-500" };
                    return (
                      <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="text-slate-700">
                          {i.kind === "one_off" ? `${i.description || "Cobrança única"} · ` : ""}
                          Vence {date(i.dueDate)} · <strong className="text-slate-900">{money(i.amountCents)}</strong>
                          {i.paidAt ? <span className="text-slate-500"> · paga em {date(i.paidAt)}</span> : null}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.className}`}>{st.text}</span>
                          {i.invoiceUrl ? (
                            <a href={i.invoiceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-orange-600 underline">
                              {i.status === "paid" ? "Comprovante" : "Pagar"}
                            </a>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
