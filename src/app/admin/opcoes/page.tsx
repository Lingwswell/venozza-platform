"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type OptionItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price_cents: number;
  sortOrder: number;
  active: boolean;
};

type OptionGroup = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  active: boolean;
  items: OptionItem[];
  categoryOptionGroups?: { id: string; category?: { id: string; name: string } }[];
};

type Draft = {
  key: string;
  id?: string;
  slug: string;
  name: string;
  price: string;
  active: boolean;
  sortOrder: number;
  dirty: boolean;
  saving: boolean;
};

type GroupForm = {
  description: string;
  type: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  active: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  size: "Tamanho",
  crust: "Borda",
  dough: "Massa",
  addon: "Adicional",
  filling: "Recheio",
  generic: "Genérico",
};

function centsToInput(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}

function inputToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "").replace(",", ".");
  if (normalized === "" || normalized === "-") return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDraft(item: OptionItem): Draft {
  return {
    key: item.id,
    id: item.id,
    slug: item.slug,
    name: item.name,
    price: centsToInput(item.price_cents),
    active: item.active,
    sortOrder: item.sortOrder,
    dirty: false,
    saving: false,
  };
}

export default function AdminOpcoesPage() {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [form, setForm] = useState<GroupForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || groups[0],
    [groups, selectedGroupId]
  );

  const loadOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetchWithAuth("/api/admin/options?includeInactive=true", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao carregar opções");
      }

      const nextGroups: OptionGroup[] = data.groups || [];
      setGroups(nextGroups);
      setSelectedGroupId((current) =>
        current && nextGroups.some((g) => g.id === current)
          ? current
          : nextGroups[0]?.id || ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar opções");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!selectedGroup) {
      setDrafts([]);
      setForm(null);
      return;
    }

    setDrafts(
      [...selectedGroup.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(toDraft)
    );
    setForm({
      description: selectedGroup.description || "",
      type: selectedGroup.type || "generic",
      required: Boolean(selectedGroup.required),
      minSelect: Number(selectedGroup.minSelect || 0),
      maxSelect: Number(selectedGroup.maxSelect || 1),
      sortOrder: Number(selectedGroup.sortOrder || 0),
      active: Boolean(selectedGroup.active),
    });
    // recarrega os rascunhos quando o grupo (ou seus itens salvos) muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);

  function updateDraft(key: string, patch: Partial<Draft>) {
    setMessage("");
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...patch, dirty: true } : draft
      )
    );
  }

  function addDraft() {
    setMessage("");
    const nextOrder = drafts.reduce((max, d) => Math.max(max, d.sortOrder), 0) + 1;
    setDrafts((current) => [
      ...current,
      {
        key: `new-${Date.now()}`,
        slug: "",
        name: "",
        price: "0,00",
        active: true,
        sortOrder: nextOrder,
        dirty: true,
        saving: false,
      },
    ]);
  }

  async function patchGroup(body: unknown, fallbackError: string) {
    if (!selectedGroup) return false;

    const response = await fetchWithAuth(`/api/admin/options/${selectedGroup.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || fallbackError);
    }
    return true;
  }

  async function saveItem(draft: Draft) {
    setError("");
    setMessage("");

    const name = draft.name.trim();
    if (!name) {
      setError("Informe o nome do item.");
      return;
    }

    const priceCents = inputToCents(draft.price);
    if (priceCents === null) {
      setError(`Preço inválido em "${name}". Use o formato 15,90.`);
      return;
    }

    if (!draft.id) {
      const newSlug = slugify(name);
      if (drafts.some((d) => d.id && d.slug === newSlug)) {
        setError(`Já existe um item "${name}" neste grupo.`);
        return;
      }
    }

    setDrafts((current) =>
      current.map((d) => (d.key === draft.key ? { ...d, saving: true } : d))
    );

    try {
      await patchGroup(
        {
          items: [
            {
              ...(draft.id ? { id: draft.id, slug: draft.slug } : {}),
              name,
              price_cents: priceCents,
              active: draft.active,
              sortOrder: draft.sortOrder,
            },
          ],
        },
        "Erro ao salvar item"
      );
      setMessage(`"${name}" salvo. O app do cliente já usa o novo valor.`);
      await loadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar item");
      setDrafts((current) =>
        current.map((d) => (d.key === draft.key ? { ...d, saving: false } : d))
      );
    }
  }

  async function saveGroup() {
    if (!form) return;

    try {
      setSavingGroup(true);
      setError("");
      setMessage("");
      await patchGroup(form, "Erro ao salvar grupo");
      setMessage("Grupo salvo.");
      await loadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar grupo");
    } finally {
      setSavingGroup(false);
    }
  }

  const isSizeGroup = selectedGroup?.type === "size";
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-orange-400";

  return (
    <AdminShell
      title="Opções"
      subtitle="Tamanhos, bordas, massas, bebidas e recheios. O app e o servidor usam estes valores."
    >
      <div className="space-y-5">
        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="px-2 pb-2 pt-1 text-sm font-black uppercase tracking-wide text-slate-500">
              Grupos
            </h3>

            {loading && groups.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">Carregando...</p>
            ) : groups.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">
                Nenhum grupo de opções cadastrado.
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => {
                  const selected = selectedGroup?.id === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setMessage("");
                        setError("");
                        setSelectedGroupId(group.id);
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-orange-400 bg-orange-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-slate-900">{group.name}</strong>
                        {!group.active ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                            Inativo
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {TYPE_LABELS[group.type] || group.type} · {group.items.length} itens
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="space-y-5">
            {!selectedGroup ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Selecione um grupo.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                        Grupo
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-900">
                        {selectedGroup.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {isSizeGroup
                          ? "No tamanho, o valor é o ajuste sobre o preço da pizza: negativo dá desconto (ex.: -10,00), zero é o preço base."
                          : "O valor é somado ao preço do produto. Zero é grátis."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadOptions}
                      disabled={loading}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {loading ? "Carregando..." : "Atualizar"}
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-2 py-2">Nome</th>
                          <th className="w-36 border-b border-slate-200 px-2 py-2">
                            Valor (R$)
                          </th>
                          <th className="w-24 border-b border-slate-200 px-2 py-2">Ativo</th>
                          <th className="w-28 border-b border-slate-200 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {drafts.map((draft) => (
                          <tr key={draft.key} className="border-b border-slate-100">
                            <td className="px-2 py-2">
                              <input
                                value={draft.name}
                                onChange={(e) => updateDraft(draft.key, { name: e.target.value })}
                                placeholder="Nome do item"
                                className={inputClass}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={draft.price}
                                onChange={(e) => updateDraft(draft.key, { price: e.target.value })}
                                inputMode="decimal"
                                className={inputClass}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <label className="flex items-center gap-2 text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.active}
                                  onChange={(e) =>
                                    updateDraft(draft.key, { active: e.target.checked })
                                  }
                                />
                                {draft.active ? "Sim" : "Não"}
                              </label>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => saveItem(draft)}
                                disabled={!draft.dirty || draft.saving}
                                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400"
                              >
                                {draft.saving ? "Salvando..." : "Salvar"}
                              </button>
                            </td>
                          </tr>
                        ))}

                        {drafts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-6 text-center text-slate-500">
                              Nenhum item neste grupo.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={addDraft}
                    className="mt-4 rounded-xl border border-dashed border-orange-300 px-4 py-2 text-sm font-bold text-orange-600 hover:bg-orange-50"
                  >
                    + Adicionar item
                  </button>
                </div>

                {form ? (
                  <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <summary className="cursor-pointer text-sm font-black text-slate-700">
                      Configurações do grupo
                    </summary>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
                        Descrição
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          className={`${inputClass} min-h-20`}
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Tipo
                        <select
                          value={form.type}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                          className={inputClass}
                        >
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Ordem
                        <input
                          type="number"
                          value={form.sortOrder}
                          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                          className={inputClass}
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Mínimo de seleção
                        <input
                          type="number"
                          value={form.minSelect}
                          onChange={(e) => setForm({ ...form, minSelect: Number(e.target.value) })}
                          className={inputClass}
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Máximo de seleção
                        <input
                          type="number"
                          value={form.maxSelect}
                          onChange={(e) => setForm({ ...form, maxSelect: Number(e.target.value) })}
                          className={inputClass}
                        />
                      </label>

                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.required}
                          onChange={(e) => setForm({ ...form, required: e.target.checked })}
                        />
                        Obrigatório
                      </label>

                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        />
                        Grupo ativo
                      </label>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={saveGroup}
                        disabled={savingGroup}
                        className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {savingGroup ? "Salvando..." : "Salvar grupo"}
                      </button>
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
