"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import Balloon from "@/components/promo/Balloon";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { promoBasePrice } from "@/lib/promotions/pricing";

// Marketing: promocoes que aparecem como baloes no site e no app.

type Product = { id: string; name: string; price_cents: number };
type Store = { id: string; name: string };
type Status = "live" | "scheduled" | "ended" | "off";
type Promotion = {
  id: string;
  title: string;
  message: string | null;
  kind: string;
  productId: string | null;
  discountType: string | null;
  discountValue: number | null;
  color: string;
  emoji: string | null;
  storeIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  status: Status;
  product: { id: string; name: string; price_cents: number; image: string | null } | null;
};

type FormState = {
  kind: "notice" | "discount";
  title: string;
  message: string;
  productId: string;
  discountType: "percent" | "fixed_price";
  discountValue: string;
  color: string;
  emoji: string;
  allStores: boolean;
  storeIds: string[];
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const EMOJIS = ["🍕", "🔥", "🎉", "🥤", "⭐", "🍫"];

const STATUS_LABEL: Record<Status, { text: string; className: string }> = {
  live: { text: "Valendo agora", className: "bg-emerald-100 text-emerald-700" },
  scheduled: { text: "Agendada", className: "bg-sky-100 text-sky-700" },
  ended: { text: "Encerrada", className: "bg-slate-100 text-slate-500" },
  off: { text: "Desligada", className: "bg-slate-100 text-slate-500" },
};

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function centsFromInput(value: string) {
  const clean = value.replace(/[^\d,.]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function period(p: Promotion) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (p.startsAt && p.endsAt) return `${fmt(p.startsAt)} até ${fmt(p.endsAt)}`;
  if (p.endsAt) return `Até ${fmt(p.endsAt)}`;
  if (p.startsAt) return `A partir de ${fmt(p.startsAt)}`;
  return "Sem data de fim";
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400";

export default function MarketingPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [colors, setColors] = useState<string[]>(["#B91C1C"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth("/api/admin/promotions");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar promoções.");
      setPromotions(data.promotions || []);
      setProducts(data.products || []);
      setStores(data.stores || []);
      setColors(data.colors || ["#B91C1C"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar promoções.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function startCreate() {
    setEditing("new");
    setError("");
    setSuccess("");
    setForm({
      kind: "discount",
      title: "",
      message: "",
      productId: products[0]?.id || "",
      discountType: "percent",
      discountValue: "20",
      color: colors[0],
      emoji: "🍕",
      allStores: true,
      storeIds: [],
      startsAt: "",
      endsAt: "",
      active: true,
    });
  }

  function startEdit(p: Promotion) {
    setEditing(p.id);
    setError("");
    setSuccess("");
    setForm({
      kind: p.kind === "discount" ? "discount" : "notice",
      title: p.title,
      message: p.message || "",
      productId: p.productId || "",
      discountType: p.discountType === "fixed_price" ? "fixed_price" : "percent",
      discountValue:
        p.discountType === "fixed_price" && p.discountValue
          ? (p.discountValue / 100).toFixed(2).replace(".", ",")
          : String(p.discountValue ?? ""),
      color: p.color,
      emoji: p.emoji || "",
      allStores: p.storeIds.length === 0,
      storeIds: p.storeIds,
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
      active: p.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form?.productId) || null,
    [products, form?.productId]
  );

  const discountValueNumber = form
    ? form.discountType === "fixed_price"
      ? centsFromInput(form.discountValue)
      : Number(form.discountValue)
    : NaN;

  const previewPrice =
    form && form.kind === "discount" && selectedProduct && Number.isFinite(discountValueNumber)
      ? promoBasePrice(selectedProduct.price_cents, {
          id: "preview",
          title: form.title,
          kind: "discount",
          productId: selectedProduct.id,
          discountType: form.discountType,
          discountValue: discountValueNumber,
          storeIds: [],
          startsAt: null,
          endsAt: null,
          active: true,
        })
      : null;

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        kind: form.kind,
        title: form.title,
        message: form.message,
        productId: form.productId || null,
        discountType: form.kind === "discount" ? form.discountType : null,
        discountValue: form.kind === "discount" ? discountValueNumber : null,
        color: form.color,
        emoji: form.emoji,
        storeIds: form.allStores ? [] : form.storeIds,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        active: form.active,
      };
      const isNew = editing === "new";
      const res = await fetchWithAuth(isNew ? "/api/admin/promotions" : `/api/admin/promotions/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar promoção.");
      setSuccess(isNew ? "Promoção criada. Ela já aparece como balão no site e no app quando estiver valendo." : "Promoção salva.");
      setEditing(null);
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar promoção.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: Promotion) {
    setError("");
    const res = await fetchWithAuth(`/api/admin/promotions/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) setError(data?.error || "Erro ao alterar promoção.");
    await load();
  }

  async function remove(p: Promotion) {
    if (!window.confirm(`Apagar a promoção "${p.title}"? Isso não pode ser desfeito.`)) return;
    setError("");
    const res = await fetchWithAuth(`/api/admin/promotions/${p.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) setError(data?.error || "Erro ao apagar promoção.");
    await load();
  }

  function balloonOf(p: {
    title: string;
    color: string;
    emoji?: string | null;
    kind: string;
    discountType: string | null;
    discountValue: number | null;
    product?: { price_cents: number; image: string | null } | null;
    priceCents?: number | null;
  }) {
    const isDiscount = p.kind === "discount";
    return {
      title: p.title || "Título da promoção",
      color: p.color,
      emoji: p.emoji,
      image: p.product?.image || null,
      badge: isDiscount && p.discountType === "percent" && p.discountValue ? `-${p.discountValue}%` : null,
      priceCents: isDiscount ? p.priceCents ?? null : null,
      originalPriceCents: isDiscount && p.product ? p.product.price_cents : null,
    };
  }

  return (
    <AdminShell title="Marketing" subtitle="Promoções que aparecem como balões no site e no app.">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-sm text-slate-600">
            Cada promoção valendo vira um balão flutuando no site e no app. Com <strong>desconto</strong>, o preço
            promocional aparece no cardápio e <strong>é o que o pedido cobra</strong>. Desligou ou passou da data, o preço volta ao normal sozinho.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="shrink-0 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
          >
            Nova promoção
          </button>
        </section>

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {editing && form ? (
          <section className="grid gap-6 rounded-3xl border border-orange-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_220px]">
            <div className="space-y-5">
              <h3 className="text-lg font-black text-slate-900">{editing === "new" ? "Nova promoção" : `Editar "${form.title}"`}</h3>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["discount", "Desconto em um produto"],
                    ["notice", "Só aviso"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("kind", value)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-bold",
                      form.kind === value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Título do balão (até 40)</span>
                  <input value={form.title} maxLength={40} onChange={(e) => update("title", e.target.value)} placeholder="Ex.: Calabresa da semana" className={inputClass} />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Mensagem (opcional, até 90)</span>
                  <input value={form.message} maxLength={90} onChange={(e) => update("message", e.target.value)} placeholder="Ex.: Só até domingo" className={inputClass} />
                </label>

                <label className="md:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                    Produto {form.kind === "discount" ? "(obrigatório)" : "(opcional — ao clicar no balão abre ele)"}
                  </span>
                  <select value={form.productId} onChange={(e) => update("productId", e.target.value)} className={inputClass}>
                    {form.kind === "notice" ? <option value="">Nenhum</option> : null}
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {money(p.price_cents)}
                      </option>
                    ))}
                  </select>
                </label>

                {form.kind === "discount" ? (
                  <>
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tipo de desconto</span>
                      <select
                        value={form.discountType}
                        onChange={(e) => update("discountType", e.target.value as FormState["discountType"])}
                        className={inputClass}
                      >
                        <option value="percent">Porcentagem (%)</option>
                        <option value="fixed_price">Preço promocional (R$)</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                        {form.discountType === "percent" ? "Desconto em % (1 a 90)" : "Preço promocional (R$)"}
                      </span>
                      <input
                        value={form.discountValue}
                        onChange={(e) => update("discountValue", e.target.value)}
                        inputMode="decimal"
                        placeholder={form.discountType === "percent" ? "20" : "34,90"}
                        className={inputClass}
                      />
                    </label>
                    {selectedProduct && previewPrice !== null ? (
                      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
                        {selectedProduct.name}: de <s>{money(selectedProduct.price_cents)}</s> por{" "}
                        <strong className="text-orange-700">{money(previewPrice)}</strong>. O desconto vale sobre o preço base;
                        tamanho, borda e bebidas são cobrados normalmente. Lojas com preço próprio usam o preço delas como base.
                      </p>
                    ) : null}
                  </>
                ) : null}

                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Começa em (vazio = agora)</span>
                  <input type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} className={inputClass} />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Termina em (vazio = sem fim)</span>
                  <input type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} className={inputClass} />
                </label>
              </div>

              <div>
                <span className="mb-2 block text-xs font-bold uppercase text-slate-500">Cor do balão</span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update("color", c)}
                      aria-label={`Cor ${c}`}
                      className={["h-9 w-9 rounded-full ring-offset-2", form.color === c ? "ring-2 ring-slate-900" : ""].join(" ")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-bold uppercase text-slate-500">Ícone (fica no lugar da foto do produto)</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => update("emoji", "")}
                    className={["rounded-full border px-3 py-1.5 text-sm font-bold", form.emoji === "" ? "border-orange-500 bg-orange-50" : "border-slate-200"].join(" ")}
                  >
                    Foto do produto
                  </button>
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => update("emoji", e)}
                      className={["h-9 w-9 rounded-full border text-lg", form.emoji === e ? "border-orange-500 bg-orange-50" : "border-slate-200"].join(" ")}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <input type="checkbox" checked={form.allStores} onChange={(e) => update("allStores", e.target.checked)} />
                  Vale em todas as lojas
                </label>
                {!form.allStores ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stores.map((s) => {
                      const on = form.storeIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            update("storeIds", on ? form.storeIds.filter((x) => x !== s.id) : [...form.storeIds, s.id])
                          }
                          className={["rounded-full border px-4 py-2 text-sm font-bold", on ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"].join(" ")}
                        >
                          {on ? "✓ " : ""}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <input type="checkbox" checked={form.active} onChange={(e) => update("active", e.target.checked)} />
                Promoção ligada
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : editing === "new" ? "Criar promoção" : "Salvar"}
                </button>
                <button type="button" onClick={() => { setEditing(null); setForm(null); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
                  Cancelar
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-3xl bg-slate-50 p-5">
              <span className="text-xs font-bold uppercase text-slate-500">Prévia do balão</span>
              <Balloon
                content={balloonOf({
                  title: form.title,
                  color: form.color,
                  emoji: form.emoji,
                  kind: form.kind,
                  discountType: form.discountType,
                  discountValue: Number.isFinite(discountValueNumber) ? discountValueNumber : null,
                  product: selectedProduct ? { price_cents: selectedProduct.price_cents, image: null } : null,
                  priceCents: previewPrice,
                })}
              />
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : promotions.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              Nenhuma promoção ainda. Clique em “Nova promoção” para criar a primeira.
            </p>
          ) : (
            promotions.map((p) => {
              const st = STATUS_LABEL[p.status];
              const price =
                p.kind === "discount" && p.product
                  ? promoBasePrice(p.product.price_cents, { ...p, startsAt: null, endsAt: null, active: true })
                  : null;
              return (
                <article key={p.id} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="shrink-0">
                    <Balloon content={balloonOf({ ...p, priceCents: price })} size={84} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-slate-900">{p.title}</strong>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.className}`}>{st.text}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {p.kind === "discount" && p.product && price !== null
                        ? `${p.product.name}: ${money(p.product.price_cents)} → ${money(price)}`
                        : p.product
                          ? `Aviso — abre ${p.product.name}`
                          : "Aviso"}
                    </p>
                    {p.message ? <p className="mt-0.5 text-xs text-slate-500">{p.message}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {period(p)} · {p.storeIds.length === 0 ? "Todas as lojas" : `${p.storeIds.length} loja(s)`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(p)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        Editar
                      </button>
                      <button type="button" onClick={() => toggle(p)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        {p.active ? "Desligar" : "Ligar"}
                      </button>
                      <button type="button" onClick={() => remove(p)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">
                        Apagar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </AdminShell>
  );
}
