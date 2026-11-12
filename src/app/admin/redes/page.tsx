"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { BILLING_LABELS, type BillingState } from "@/lib/billing/state";

// Painel da plataforma: todas as redes, planos e acoes de cobranca.

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  trialDays: number;
  maxStores: number | null;
  active: boolean;
  sortOrder: number;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  state: BillingState;
  trialEndsAt: string | null;
  suspendedReason: string | null;
  hasSubscription: boolean;
  createdAt: string;
  onboarded: boolean;
  plan: { id: string; name: string; priceCents: number } | null;
  stores: number;
  monthlyCents: number | null;
  owner: { name: string; email: string } | null;
  domains: string[];
  siteUrl: string | null;
  orders30: number;
  sales30Cents: number;
  lastInvoice: { status: string; dueDate: string; amountCents: number } | null;
};

const STATE_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-sky-100 text-sky-700",
  trial_expired: "bg-amber-100 text-amber-700",
  past_due: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  canceled: "bg-slate-200 text-slate-600",
};

const input = "w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-orange-400";
const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
const primary = "rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60";
const ghost = "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function centsFrom(text: string) {
  const raw = text.trim();
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export default function RedesPage() {
  const [tab, setTab] = useState<"redes" | "planos">("redes");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [asaas, setAsaas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("todas");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", ownerName: "", ownerEmail: "", ownerPassword: "", planId: "", trialDays: "", domain: "" });
  const [planForm, setPlanForm] = useState<{ id: string | null; name: string; description: string; price: string; trialDays: string; maxStores: string; active: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/platform/tenants");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar as redes.");
      setTenants(data.tenants);
      setPlans(data.plans);
      setAsaas(data.asaas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar as redes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(tenant: Tenant, body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth(`/api/admin/platform/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao atualizar a rede.");
      setSuccess(`${tenant.name}: ${done}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar a rede.");
    } finally {
      setBusy(false);
    }
  }

  async function createTenant() {
    setBusy(true);
    setError("");
    try {
      const res = await fetchWithAuth("/api/admin/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, planId: form.planId || undefined, trialDays: form.trialDays === "" ? undefined : Number(form.trialDays) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao criar a rede.");
      setSuccess(`Rede ${data.tenant.name} criada. O dono já pode entrar no painel com ${form.ownerEmail}.`);
      setCreating(false);
      setForm({ name: "", ownerName: "", ownerEmail: "", ownerPassword: "", planId: "", trialDays: "", domain: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar a rede.");
    } finally {
      setBusy(false);
    }
  }

  async function savePlan() {
    if (!planForm) return;
    setBusy(true);
    setError("");
    try {
      const priceCents = centsFrom(planForm.price);
      if (!Number.isFinite(priceCents)) throw new Error("Valor inválido.");
      const body = {
        name: planForm.name,
        description: planForm.description,
        priceCents,
        trialDays: Number(planForm.trialDays || 0),
        maxStores: planForm.maxStores.trim() === "" ? null : Number(planForm.maxStores),
        active: planForm.active,
      };
      const res = await fetchWithAuth(planForm.id ? `/api/admin/platform/plans/${planForm.id}` : "/api/admin/platform/plans", {
        method: planForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar o plano.");
      setSuccess(
        data.failed
          ? `Plano salvo, mas ${data.failed} assinatura(s) no Asaas não foram atualizadas. Use "Atualizar cobrança" na rede.`
          : "Plano salvo."
      );
      setPlanForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o plano.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const c = { total: tenants.length, active: 0, trial: 0, late: 0, blocked: 0, mrr: 0 };
    for (const t of tenants) {
      if (t.state.key === "active") c.active += 1;
      if (t.state.key === "trial") c.trial += 1;
      if (t.state.key === "past_due" || t.state.key === "trial_expired") c.late += 1;
      if (t.state.blocked) c.blocked += 1;
      if (t.state.key === "active" && t.monthlyCents) c.mrr += t.monthlyCents;
    }
    return c;
  }, [tenants]);

  const visible = tenants.filter((t) => {
    if (filter === "todas") return true;
    if (filter === "bloqueadas") return t.state.blocked;
    if (filter === "atrasadas") return t.state.key === "past_due" || t.state.key === "trial_expired";
    return t.state.key === filter;
  });

  return (
    <AdminShell title="Redes" subtitle="Todas as redes da plataforma: situação, plano, lojas e cobrança.">
      <div className="flex flex-col gap-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Redes", value: String(counts.total) },
            { label: "Pagando", value: String(counts.active) },
            { label: "Em teste", value: String(counts.trial) },
            { label: "Atrasadas", value: String(counts.late) },
            { label: "Mensalidade das que pagam", value: money(counts.mrr) },
          ].map((k) => (
            <div key={k.label} className={card}>
              <p className="text-xs font-bold text-slate-500">{k.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{k.value}</p>
            </div>
          ))}
        </section>

        <nav className="flex flex-wrap items-center gap-2">
          {(["redes", "planos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-bold",
                tab === t ? "border-orange-500 bg-orange-500 text-white" : "border-slate-200 bg-white text-slate-700",
              ].join(" ")}
            >
              {t === "redes" ? "Redes" : "Planos"}
            </button>
          ))}
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${asaas ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {asaas ? "Cobrança automática (Asaas) ligada" : "Cobrança automática desligada: pagamentos lançados à mão"}
          </span>
        </nav>

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {tab === "redes" ? (
          <>
            <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div className="flex flex-wrap gap-2">
                {[
                  ["todas", "Todas"],
                  ["trial", "Em teste"],
                  ["active", "Pagando"],
                  ["atrasadas", "Atrasadas"],
                  ["bloqueadas", "Bloqueadas"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`${ghost} ${filter === key ? "border-orange-400 bg-orange-50" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setCreating(true)} className={primary}>
                Nova rede
              </button>
            </section>

            {creating ? (
              <section className={`${card} border-orange-200`}>
                <h3 className="text-base font-black text-slate-900">Nova rede</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Cria a rede e o login do dono. Ele entra no painel e segue os primeiros passos (marca, loja e cardápio).
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input className={input} placeholder="Nome da pizzaria ou rede" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className={input} placeholder="Domínio (opcional): pedidos.pizzaria.com.br" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
                  <input className={input} placeholder="Nome do dono" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
                  <input className={input} placeholder="E-mail do dono (login)" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
                  <input className={input} type="password" placeholder="Senha inicial (mín. 8)" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <select className={input} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                      <option value="">Plano padrão</option>
                      {plans.filter((p) => p.active).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {money(p.priceCents)}/loja
                        </option>
                      ))}
                    </select>
                    <input className={input} inputMode="numeric" placeholder="Dias de teste" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" disabled={busy} onClick={createTenant} className={primary}>
                    Criar rede
                  </button>
                  <button type="button" onClick={() => setCreating(false)} className={ghost}>
                    Cancelar
                  </button>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 xl:grid-cols-2">
              {loading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : visible.length === 0 ? (
                <p className={`${card} text-sm text-slate-500`}>Nenhuma rede neste filtro.</p>
              ) : (
                visible.map((t) => (
                  <TenantCard key={t.id} tenant={t} plans={plans} asaas={asaas} busy={busy} act={act} />
                ))
              )}
            </section>
          </>
        ) : (
          <section className="flex flex-col gap-4">
            <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <p className="max-w-2xl text-sm text-slate-600">
                O valor do plano é por loja ativa, por mês. Mudar o valor atualiza as próximas faturas das redes nesse plano
                (no Asaas). Desligar um plano tira ele do cadastro, mas quem já usa continua nele.
              </p>
              <button
                type="button"
                onClick={() => setPlanForm({ id: null, name: "", description: "", price: "", trialDays: "14", maxStores: "", active: true })}
                className={primary}
              >
                Novo plano
              </button>
            </div>

            {planForm ? (
              <div className={`${card} border-orange-200`}>
                <div className="grid gap-3 md:grid-cols-3">
                  <input className={input} placeholder="Nome" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
                  <input className={input} placeholder="R$ por loja/mês" inputMode="decimal" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={input} placeholder="Dias de teste" inputMode="numeric" value={planForm.trialDays} onChange={(e) => setPlanForm({ ...planForm, trialDays: e.target.value })} />
                    <input className={input} placeholder="Máx. lojas" inputMode="numeric" value={planForm.maxStores} onChange={(e) => setPlanForm({ ...planForm, maxStores: e.target.value })} />
                  </div>
                  <input className={`${input} md:col-span-2`} placeholder="Descrição (aparece no cadastro)" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <input type="checkbox" checked={planForm.active} onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })} />
                    Disponível para novas redes
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" disabled={busy} onClick={savePlan} className={primary}>
                    Salvar plano
                  </button>
                  <button type="button" onClick={() => setPlanForm(null)} className={ghost}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((p) => (
                <article key={p.id} className={card}>
                  <div className="flex items-center justify-between">
                    <strong className="text-lg text-slate-900">{p.name}</strong>
                    {!p.active ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Desligado</span> : null}
                  </div>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {money(p.priceCents)}
                    <span className="text-sm font-semibold text-slate-500"> /loja/mês</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{p.description || "Sem descrição."}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.trialDays} dias de teste · {p.maxStores ? `até ${p.maxStores} loja(s)` : "lojas ilimitadas"}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setPlanForm({
                        id: p.id,
                        name: p.name,
                        description: p.description || "",
                        price: (p.priceCents / 100).toFixed(2).replace(".", ","),
                        trialDays: String(p.trialDays),
                        maxStores: p.maxStores ? String(p.maxStores) : "",
                        active: p.active,
                      })
                    }
                    className={`${ghost} mt-3`}
                  >
                    Editar
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function TenantCard({
  tenant: t,
  plans,
  asaas,
  busy,
  act,
}: {
  tenant: Tenant;
  plans: Plan[];
  asaas: boolean;
  busy: boolean;
  act: (t: Tenant, body: Record<string, unknown>, done: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<"" | "trial" | "paid" | "domain" | "plan">("");
  const [value, setValue] = useState("");

  return (
    <article className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-900">{t.name}</h3>
          <p className="text-xs text-slate-500">
            {t.owner ? `${t.owner.name} · ${t.owner.email}` : "Sem dono ativo"} · desde {date(t.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATE_STYLE[t.state.key] || ""}`}>
          {BILLING_LABELS[t.state.key]}
          {t.state.key === "trial" && t.state.daysLeft !== null ? ` · ${t.state.daysLeft} dia(s)` : ""}
          {t.state.blocked ? " · bloqueada" : ""}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Plano</dt>
          <dd className="font-bold text-slate-900">{t.plan?.name || "Sem plano"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Lojas</dt>
          <dd className="font-bold text-slate-900">{t.stores}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Mensalidade</dt>
          <dd className="font-bold text-slate-900">{t.monthlyCents !== null ? money(t.monthlyCents) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Vendas 30 dias</dt>
          <dd className="font-bold text-slate-900">
            {money(t.sales30Cents)} <span className="text-xs font-normal text-slate-500">({t.orders30})</span>
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-slate-500">
        {t.siteUrl ? (
          <a href={t.siteUrl} target="_blank" rel="noreferrer" className="font-bold text-orange-600 underline">
            {t.siteUrl.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          "Sem domínio"
        )}
        {t.domains.length > 1 ? ` (+${t.domains.length - 1})` : ""}
        {t.lastInvoice ? ` · última fatura ${money(t.lastInvoice.amountCents)} em ${date(t.lastInvoice.dueDate)} (${t.lastInvoice.status})` : ""}
        {!t.onboarded && t.plan ? " · primeiros passos pendentes" : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.state.key === "suspended" || t.state.key === "canceled" || t.state.blocked ? (
          <button type="button" disabled={busy} onClick={() => act(t, { action: "reactivate" }, "reativada.")} className={ghost}>
            Reativar
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => window.confirm(`Suspender ${t.name}? O site e o app param de receber pedidos.`) && act(t, { action: "suspend", reason: "manual" }, "suspensa.")}
            className={`${ghost} text-rose-600`}
          >
            Suspender
          </button>
        )}
        <button type="button" onClick={() => { setOpen(open === "trial" ? "" : "trial"); setValue("7"); }} className={ghost}>
          Estender teste
        </button>
        <button type="button" onClick={() => { setOpen(open === "paid" ? "" : "paid"); setValue(t.monthlyCents ? (t.monthlyCents / 100).toFixed(2).replace(".", ",") : ""); }} className={ghost}>
          Registrar pagamento
        </button>
        <button type="button" onClick={() => { setOpen(open === "plan" ? "" : "plan"); setValue(t.plan?.id || ""); }} className={ghost}>
          Trocar plano
        </button>
        <button type="button" onClick={() => { setOpen(open === "domain" ? "" : "domain"); setValue(""); }} className={ghost}>
          Domínios
        </button>
        {asaas && t.hasSubscription ? (
          <button type="button" disabled={busy} onClick={() => act(t, { action: "sync" }, "cobrança atualizada.")} className={ghost}>
            Atualizar cobrança
          </button>
        ) : null}
      </div>

      {open === "trial" ? (
        <div className="mt-3 flex gap-2">
          <input className={input} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Dias" />
          <button type="button" disabled={busy} onClick={() => act(t, { action: "extend_trial", days: Number(value) }, `teste estendido em ${value} dia(s).`).then(() => setOpen(""))} className={primary}>
            Estender
          </button>
        </div>
      ) : null}
      {open === "paid" ? (
        <div className="mt-3 flex gap-2">
          <input className={input} inputMode="decimal" placeholder="Valor recebido (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
          <button
            type="button"
            disabled={busy}
            onClick={() => act(t, { action: "mark_paid", amountCents: centsFrom(value) }, "pagamento registrado e rede ativa.").then(() => setOpen(""))}
            className={primary}
          >
            Registrar
          </button>
        </div>
      ) : null}
      {open === "plan" ? (
        <div className="mt-3 flex gap-2">
          <select className={input} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Sem plano</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.priceCents)}/loja
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => act(t, { action: "set_plan", planId: value || null }, "plano trocado.").then(() => setOpen(""))} className={primary}>
            Salvar
          </button>
        </div>
      ) : null}
      {open === "domain" ? (
        <div className="mt-3 space-y-2">
          {t.domains.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span>{d}</span>
              <button type="button" disabled={busy} onClick={() => act(t, { action: "remove_domain", host: d }, `domínio ${d} removido.`)} className={`${ghost} text-rose-600`}>
                Tirar
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input className={input} placeholder="pedidos.pizzaria.com.br" value={value} onChange={(e) => setValue(e.target.value)} />
            <button type="button" disabled={busy} onClick={() => act(t, { action: "add_domain", host: value }, "domínio adicionado.").then(() => setValue(""))} className={primary}>
              Adicionar
            </button>
          </div>
          <p className="text-xs text-slate-500">O domínio precisa apontar (DNS) para o servidor da plataforma.</p>
        </div>
      ) : null}
    </article>
  );
}
