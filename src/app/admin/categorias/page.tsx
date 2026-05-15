"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sortOrder: number;
  active: boolean;
  showInMobile: boolean;
  showInSite: boolean;
};

type CategoriesResponse = {
  ok?: boolean;
  categories?: Category[];
  error?: string;
  message?: string;
};

type CategoryForm = {
  name: string;
  slug: string;
  icon: string;
  sortOrder: string;
  active: boolean;
  showInMobile: boolean;
  showInSite: boolean;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>({
    name: "",
    slug: "",
    icon: "🍕",
    sortOrder: "0",
    active: true,
    showInMobile: true,
    showInSite: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCategories() {
    setLoading(true);
    setError("");

    try {
      const res = await fetchWithAuth("/api/admin/categories", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as CategoriesResponse;

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.message || "Erro ao carregar categorias.");
      }

      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (err) {
      setCategories([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function updateForm<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth("/api/admin/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name),
          icon: form.icon,
          sortOrder: Number(form.sortOrder || 0),
          active: form.active,
          showInMobile: form.showInMobile,
          showInSite: form.showInSite,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao salvar categoria.");
      }

      setSuccess("Categoria salva com sucesso.");
      setForm({
        name: "",
        slug: "",
        icon: "🍕",
        sortOrder: "0",
        active: true,
        showInMobile: true,
        showInSite: false,
      });

      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = useMemo(() => {
    return categories.filter((category) => category.active).length;
  }, [categories]);

  const mobileCount = useMemo(() => {
    return categories.filter((category) => category.showInMobile).length;
  }, [categories]);

  return (
    <AdminShell
      title="Categorias"
      subtitle="Gerencie as categorias que serão usadas no catálogo, mobile e futuramente no site."
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Total de categorias</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "..." : categories.length}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Ativas</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "..." : activeCount}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">No mobile</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {loading ? "..." : mobileCount}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
              Cadastro
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              Nova categoria
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              O slug será usado no campo categoria dos produtos.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Nome
              </span>
              <input
                value={form.name}
                onChange={(event) => {
                  const value = event.target.value;
                  updateForm("name", value);
                  if (!form.slug) {
                    updateForm("slug", slugify(value));
                  }
                }}
                placeholder="Ex: Pizza"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Slug
              </span>
              <input
                value={form.slug}
                onChange={(event) => updateForm("slug", slugify(event.target.value))}
                placeholder="pizza"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Ícone
              </span>
              <input
                value={form.icon}
                onChange={(event) => updateForm("icon", event.target.value)}
                placeholder="🍕"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Ordem
              </span>
              <input
                value={form.sortOrder}
                onChange={(event) => updateForm("sortOrder", event.target.value)}
                placeholder="0"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateForm("active", event.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">Ativa</span>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={form.showInMobile}
                onChange={(event) => updateForm("showInMobile", event.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">Mostrar no /m</span>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={form.showInSite}
                onChange={(event) => updateForm("showInSite", event.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">Mostrar no site</span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar categoria"}
            </button>

            <button
              type="button"
              onClick={() => loadCategories()}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Atualizar
            </button>
          </div>
        </form>

        {success ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 shadow-sm">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">Categorias cadastradas</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Categoria</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Slug</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Ordem</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-600">Exibição</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <span className="mr-2">{category.icon || "📂"}</span>
                      {category.name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{category.slug}</td>
                    <td className="px-5 py-4 text-slate-600">{category.sortOrder}</td>
                    <td className="px-5 py-4">
                      {category.active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Ativa
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          Inativa
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {category.showInMobile ? "Mobile" : ""}
                      {category.showInMobile && category.showInSite ? " / " : ""}
                      {category.showInSite ? "Site" : ""}
                    </td>
                  </tr>
                ))}

                {!loading && categories.length === 0 ? (
                  <tr>
                    <td className="px-5 py-5 text-sm text-slate-500" colSpan={5}>
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
