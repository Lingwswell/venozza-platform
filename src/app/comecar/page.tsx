"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Cadastro publico: a pizzaria cria a conta, entra em teste gratis e cai nos primeiros passos.

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  trialDays: number;
  maxStores: number | null;
};

const field =
  "w-full rounded-xl border border-[#E7E5E4] bg-white px-4 py-3 text-[15px] text-[#1C1917] outline-none placeholder:text-[#8A8580] focus:border-[#1C1917]";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ComecarPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState({ name: "", ownerName: "", ownerEmail: "", ownerPassword: "", planId: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/signup")
      .then((r) => r.json())
      .then((data) => {
        setEnabled(Boolean(data?.enabled));
        const list: Plan[] = data?.plans || [];
        setPlans(list);
        setForm((f) => ({ ...f, planId: f.planId || list[0]?.id || "" }));
      })
      .catch(() => setEnabled(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível criar a conta.");

      // Mesma sessao do login do painel.
      localStorage.setItem("venozza_token", data.token);
      localStorage.setItem("venozza_user", JSON.stringify(data.user));
      document.cookie = `venozza_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      router.push("/admin/primeiros-passos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
      setBusy(false);
    }
  }

  const plan = plans.find((p) => p.id === form.planId);

  return (
    <main className="min-h-screen bg-[#F6F5F2] px-5 py-10 font-sans text-[#1C1917]">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_440px] lg:items-start">
        <section className="pt-4">
          <h1 className="max-w-xl text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[52px]">
            Site, app e cozinha da sua pizzaria num lugar só.
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-[#57534E]">
            Pedidos pelo site e pelo app, tela da cozinha, estoque com ficha técnica e relatório de cada loja.
            {plan?.trialDays ? ` Teste ${plan.trialDays} dias sem pagar nada.` : ""}
          </p>
          <ul className="mt-8 space-y-3 text-[15px] text-[#1C1917]">
            <li>Cardápio com tamanhos, bordas e meio a meio</li>
            <li>Tela da cozinha em tempo real</li>
            <li>Várias lojas com estoque e cozinha central</li>
            <li>Custo e margem de cada pizza</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-[#E7E5E4] bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
          {!enabled ? (
            <p className="text-[15px] text-[#57534E]">O cadastro está fechado no momento. Fale com a gente para criar sua conta.</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">Criar conta</h2>

              {plans.length > 1 ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-semibold text-[#57534E]">Plano</legend>
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      className={[
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3",
                        form.planId === p.id ? "border-[#1C1917] bg-[#F6F5F2]" : "border-[#E7E5E4]",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="plan"
                        className="mt-1"
                        checked={form.planId === p.id}
                        onChange={() => setForm({ ...form, planId: p.id })}
                      />
                      <span>
                        <span className="block font-bold">
                          {p.name} · {money(p.priceCents)}
                          <span className="font-normal text-[#57534E]"> por loja/mês</span>
                        </span>
                        {p.description ? <span className="block text-sm text-[#57534E]">{p.description}</span> : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}

              <label className="text-sm font-semibold text-[#57534E]">
                Nome da pizzaria
                <input className={`${field} mt-1`} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="text-sm font-semibold text-[#57534E]">
                Seu nome
                <input className={`${field} mt-1`} required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </label>
              <label className="text-sm font-semibold text-[#57534E]">
                E-mail (seu login)
                <input
                  className={`${field} mt-1`}
                  type="email"
                  required
                  autoComplete="email"
                  value={form.ownerEmail}
                  onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-[#57534E]">
                Senha (mínimo 8 caracteres)
                <input
                  className={`${field} mt-1`}
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.ownerPassword}
                  onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                />
              </label>
              {/* Campo escondido contra robos. */}
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />

              {error ? <p className="rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">{error}</p> : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 rounded-full bg-[#B91C1C] px-6 py-3.5 text-[15px] font-bold text-white hover:bg-[#991B1B] disabled:opacity-60"
              >
                {busy ? "Criando sua conta..." : plan?.trialDays ? `Começar ${plan.trialDays} dias grátis` : "Criar conta"}
              </button>
              <p className="text-center text-sm text-[#57534E]">
                Já tem conta?{" "}
                <Link href="/admin/login" className="font-bold text-[#1C1917] underline">
                  Entrar
                </Link>
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
