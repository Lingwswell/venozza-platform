"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import {
  Notice,
  QtyInput,
  UNIT_LABELS,
  bigUnit,
  cardClass,
  formatQuantity,
  fromBase,
  ghostButton,
  inputClass,
  primaryButton,
  toBase,
  costUnitLabel,
  money,
} from "@/components/admin/estoque/shared";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  minStore: number | null;
  reorderQuantity: number | null;
  costCents: number | null;
  active: boolean;
  _count: { recipeItems: number };
};

type Form = {
  name: string;
  unit: string;
  minText: string;
  minBig: boolean;
  reorderText: string;
  reorderBig: boolean;
  costText: string;
  active: boolean;
};

const emptyForm: Form = {
  name: "",
  unit: "g",
  minText: "",
  minBig: false,
  reorderText: "",
  reorderBig: true,
  costText: "",
  active: true,
};

export default function IngredientsTab() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/stock/ingredients");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar os insumos.");
      setItems(data.ingredients);
      setCanEdit(data.canEdit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar os insumos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startNew() {
    setEditing("new");
    setForm(emptyForm);
    setError("");
    setSuccess("");
  }

  function startEdit(item: Ingredient) {
    const min = fromBase(item.minStore, item.unit);
    const reorder = fromBase(item.reorderQuantity, item.unit);
    setEditing(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      minText: min.text,
      minBig: min.big,
      reorderText: reorder.text,
      reorderBig: reorder.text ? reorder.big : bigUnit(item.unit) !== null,
      costText: item.costCents !== null ? (item.costCents / 100).toFixed(2).replace(".", ",") : "",
      active: item.active,
    });
    setError("");
    setSuccess("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const minStore = form.minText.trim() ? toBase(form.minText, form.unit, form.minBig) : null;
      const reorderQuantity = form.reorderText.trim() ? toBase(form.reorderText, form.unit, form.reorderBig) : null;
      if ((minStore !== null && !Number.isFinite(minStore)) || (reorderQuantity !== null && !Number.isFinite(reorderQuantity))) {
        throw new Error("Número inválido.");
      }
      const costRaw = form.costText.trim();
      const costCents = costRaw
        ? Math.round(Number(costRaw.includes(",") ? costRaw.replace(/\./g, "").replace(",", ".") : costRaw) * 100)
        : null;
      if (costCents !== null && (!Number.isFinite(costCents) || costCents < 0)) throw new Error("Custo inválido.");
      const isNew = editing === "new";
      const res = await fetchWithAuth(isNew ? "/api/admin/stock/ingredients" : `/api/admin/stock/ingredients/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, unit: form.unit, minStore, reorderQuantity, costCents, active: form.active }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar o insumo.");
      setSuccess(isNew ? `${form.name} cadastrado.` : `${form.name} salvo.`);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar o insumo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardClass} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
        <p className="max-w-2xl text-sm text-slate-600">
          Insumos são o que a cozinha gasta: mussarela, molho, bolinha de massa, caixa. O mínimo vale para todas as lojas
          (cada loja pode trocar o dela na aba Estoque). Quando uma loja passa do mínimo, o sistema pede a reposição para a cozinha central.
        </p>
        {canEdit ? (
          <button type="button" onClick={startNew} className={`${primaryButton} shrink-0`}>
            Novo insumo
          </button>
        ) : null}
      </section>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {success ? <Notice kind="success">{success}</Notice> : null}

      {editing ? (
        <section className={`${cardClass} border-orange-200`}>
          <h3 className="text-base font-black text-slate-900">{editing === "new" ? "Novo insumo" : `Editar ${form.name}`}</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">Nome</span>
              <input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Mussarela" className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">Como é medido</span>
              <select
                value={form.unit}
                onChange={(e) => {
                  const unit = e.target.value;
                  setForm({ ...form, unit, minBig: false, reorderBig: bigUnit(unit) !== null });
                }}
                className={inputClass}
              >
                {Object.entries(UNIT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-xs font-bold text-slate-500">Mínimo nas lojas (alerta)</span>
              <QtyInput
                unit={form.unit}
                text={form.minText}
                big={form.minBig}
                onText={(v) => setForm({ ...form, minText: v })}
                onBig={(v) => setForm({ ...form, minBig: v })}
                placeholder="Ex.: 500"
                ariaLabel="Mínimo nas lojas"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold text-slate-500">Quanto pedir à central (vazio = completa 2x o mínimo)</span>
              <QtyInput
                unit={form.unit}
                text={form.reorderText}
                big={form.reorderBig}
                onText={(v) => setForm({ ...form, reorderText: v })}
                onBig={(v) => setForm({ ...form, reorderBig: v })}
                placeholder="Ex.: 2"
                ariaLabel="Quantidade de reposição"
              />
            </div>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">
                Quanto custa, em R$ por {costUnitLabel(form.unit)} (para calcular a margem)
              </span>
              <input
                value={form.costText}
                onChange={(e) => setForm({ ...form, costText: e.target.value })}
                inputMode="decimal"
                placeholder={form.unit === "un" ? "Ex.: 0,80" : "Ex.: 42,90"}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Insumo em uso
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} disabled={saving} className={primaryButton}>
              {saving ? "Salvando..." : editing === "new" ? "Cadastrar" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className={ghostButton}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      <section className={cardClass}>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum insumo ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className={["font-bold", item.active ? "text-slate-900" : "text-slate-400 line-through"].join(" ")}>{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {UNIT_LABELS[item.unit] || item.unit}
                    {item.minStore !== null ? ` · mínimo ${formatQuantity(item.minStore, item.unit)}` : " · sem mínimo"}
                    {item.reorderQuantity !== null ? ` · pede ${formatQuantity(item.reorderQuantity, item.unit)}` : ""}
                    {item.costCents !== null ? ` · ${money(item.costCents)}/${costUnitLabel(item.unit)}` : " · sem custo"}
                    {` · em ${item._count.recipeItems} ficha(s)`}
                  </p>
                </div>
                {canEdit ? (
                  <button type="button" onClick={() => startEdit(item)} className={ghostButton}>
                    Editar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
