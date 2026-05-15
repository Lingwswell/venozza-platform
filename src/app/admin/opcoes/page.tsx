"use client";

import { useEffect, useMemo, useState } from "react";

type StoreAvailability = {
  id: string;
  available: boolean;
  stock: number | null;
  price_cents: number | null;
  store?: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
  };
};

type OptionItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price_cents: number;
  sortOrder: number;
  active: boolean;
  storeOptionAvailabilities?: StoreAvailability[];
};

type CategoryOptionGroup = {
  id: string;
  active: boolean;
  category?: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    showInMobile: boolean;
    showInSite: boolean;
  };
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
  categoryOptionGroups: CategoryOptionGroup[];
};

type OptionsResponse = {
  ok: boolean;
  error?: string;
  total?: number;
  groups?: OptionGroup[];
};

type EditForm = {
  description: string;
  type: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  active: boolean;
};

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("venozza_token") || "";
}

function formatMoney(cents: number) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    size: "Tamanho",
    crust: "Borda",
    dough: "Massa",
    addon: "Adicional",
    filling: "Recheio",
    generic: "Genérico",
  };

  return map[type] || type;
}

export default function AdminOpcoesPage() {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || groups[0],
    [groups, selectedGroupId]
  );

  const [form, setForm] = useState<EditForm>({
    description: "",
    type: "generic",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 0,
    active: true,
  });

  async function loadOptions() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token = getToken();

      const response = await fetch("/api/admin/options?includeInactive=true", {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      const data = (await response.json()) as OptionsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao carregar opções");
      }

      const nextGroups = data.groups || [];
      setGroups(nextGroups);

      if (!selectedGroupId && nextGroups.length > 0) {
        setSelectedGroupId(nextGroups[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar opções");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedGroup) return;

    setForm({
      description: selectedGroup.description || "",
      type: selectedGroup.type || "generic",
      required: Boolean(selectedGroup.required),
      minSelect: Number(selectedGroup.minSelect || 0),
      maxSelect: Number(selectedGroup.maxSelect || 1),
      sortOrder: Number(selectedGroup.sortOrder || 0),
      active: Boolean(selectedGroup.active),
    });
  }, [selectedGroup?.id]);

  async function saveGroup() {
    if (!selectedGroup) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const token = getToken();

      const response = await fetch(`/api/admin/options/${selectedGroup.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao salvar grupo");
      }

      setMessage("Grupo salvo com sucesso.");
      await loadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar grupo");
    } finally {
      setSaving(false);
    }
  }

  const totalItems = groups.reduce(
    (sum, group) => sum + (group.items?.length || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
              VenoZza Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">
              Opções de montagem
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Configure grupos como tamanho, borda, massa, recheios e adicionais.
              Esta tela já consome o motor SaaS de opções do banco.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOptions}
            className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </header>

        {(message || error) && (
          <section
            className={`rounded-2xl border p-4 text-sm ${
              error
                ? "border-red-400/40 bg-red-500/10 text-red-200"
                : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {error || message}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Grupos</p>
            <strong className="mt-2 block text-3xl">{groups.length}</strong>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Itens</p>
            <strong className="mt-2 block text-3xl">{totalItems}</strong>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Status</p>
            <strong className="mt-2 block text-lg text-emerald-300">
              Motor SaaS ativo
            </strong>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 text-lg font-bold">Grupos cadastrados</h2>

            {loading ? (
              <p className="text-sm text-slate-400">Carregando opções...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhum grupo de opções encontrado.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedGroup?.id === group.id
                        ? "border-orange-400 bg-orange-500/15"
                        : "border-white/10 bg-slate-900/70 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="block">{group.name}</strong>
                        <span className="mt-1 block text-xs text-slate-400">
                          {group.slug}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          group.active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {group.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white/10 px-2 py-1">
                        {getTypeLabel(group.type)}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1">
                        {group.items.length} itens
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1">
                        {group.required ? "Obrigatório" : "Opcional"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            {!selectedGroup ? (
              <p className="text-sm text-slate-400">
                Selecione um grupo para visualizar.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 border-b border-white/10 pb-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-300">
                    Grupo selecionado
                  </p>
                  <h2 className="text-2xl font-bold">{selectedGroup.name}</h2>
                  <p className="text-sm text-slate-400">{selectedGroup.slug}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {selectedGroup.categoryOptionGroups.map((relation) =>
                      relation.category ? (
                        <span
                          key={relation.category.id}
                          className="rounded-full bg-orange-500/15 px-3 py-1 text-orange-200"
                        >
                          {relation.category.name}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    Descrição
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      className="min-h-24 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                    />
                  </label>

                  <div className="grid gap-4">
                    <label className="flex flex-col gap-2 text-sm">
                      Tipo
                      <select
                        value={form.type}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            type: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                      >
                        <option value="generic">Genérico</option>
                        <option value="size">Tamanho</option>
                        <option value="crust">Borda</option>
                        <option value="dough">Massa</option>
                        <option value="addon">Adicional</option>
                        <option value="filling">Recheio</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={form.required}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            required: event.target.checked,
                          }))
                        }
                      />
                      Obrigatório
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-sm">
                    Mínimo de seleção
                    <input
                      type="number"
                      value={form.minSelect}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minSelect: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    Máximo de seleção
                    <input
                      type="number"
                      value={form.maxSelect}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxSelect: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    Ordem
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sortOrder: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          active: event.target.checked,
                        }))
                      }
                    />
                    Grupo ativo
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveGroup}
                    disabled={saving}
                    className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar grupo"}
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <h3 className="mb-4 text-lg font-bold">Itens do grupo</h3>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-400">
                        <tr>
                          <th className="border-b border-white/10 px-3 py-3">
                            Item
                          </th>
                          <th className="border-b border-white/10 px-3 py-3">
                            Slug
                          </th>
                          <th className="border-b border-white/10 px-3 py-3">
                            Preço
                          </th>
                          <th className="border-b border-white/10 px-3 py-3">
                            Lojas
                          </th>
                          <th className="border-b border-white/10 px-3 py-3">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroup.items.map((item) => (
                          <tr key={item.id} className="border-b border-white/5">
                            <td className="px-3 py-3 font-medium">
                              {item.name}
                            </td>
                            <td className="px-3 py-3 text-slate-400">
                              {item.slug}
                            </td>
                            <td className="px-3 py-3">
                              {formatMoney(item.price_cents)}
                            </td>
                            <td className="px-3 py-3 text-slate-400">
                              {item.storeOptionAvailabilities?.length || 0}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-xs ${
                                  item.active
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-red-500/15 text-red-300"
                                }`}
                              >
                                {item.active ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {selectedGroup.items.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-6 text-center text-slate-400"
                            >
                              Nenhum item cadastrado neste grupo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
