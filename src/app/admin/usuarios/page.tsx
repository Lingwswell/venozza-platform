"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

type RoleOption = { value: Role; label: string; description: string; needsStores: boolean };
type StoreOption = { id: string; name: string };
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  active: boolean;
  stores: StoreOption[];
  canEdit: boolean;
};

type FormState = {
  name: string;
  email: string;
  role: Role | "";
  storeIds: string[];
  password: string;
  active: boolean;
};

const EMPTY: FormState = { name: "", email: "", role: "", storeIds: [], password: "", active: true };

const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400";

export default function UsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth("/api/admin/users");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar usuários.");
      setUsers(data.users || []);
      setRoles(data.roles || []);
      setStores(data.stores || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedRole = roles.find((r) => r.value === form.role);

  const visibleUsers = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      `${u.name} ${u.email} ${u.stores.map((s) => s.name).join(" ")}`.toLowerCase().includes(term)
    );
  }, [users, filter]);

  function startCreate() {
    setEditing("new");
    setForm({ ...EMPTY, role: roles[roles.length - 1]?.value || "", storeIds: stores.length === 1 ? [stores[0].id] : [] });
    setError("");
    setSuccess("");
  }

  function startEdit(user: AdminUser) {
    setEditing(user.id);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role || "",
      storeIds: user.stores.map((s) => s.id),
      password: "",
      active: user.active,
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleStore(id: string) {
    setForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id) ? f.storeIds.filter((s) => s !== id) : [...f.storeIds, id],
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const isNew = editing === "new";
      const body: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        storeIds: form.storeIds,
      };
      if (isNew) {
        body.email = form.email;
        body.password = form.password;
      } else {
        body.active = form.active;
        if (form.password) body.password = form.password;
      }

      const res = await fetchWithAuth(isNew ? "/api/admin/users" : `/api/admin/users/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar usuário.");

      setSuccess(isNew ? "Usuário criado. Passe o e-mail e a senha para a pessoa." : "Usuário salvo.");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar usuário.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Usuários" subtitle="Equipe da rede: quem acessa o quê.">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nome, e-mail ou loja"
            className="w-full max-w-md rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
          />
          {roles.length > 0 ? (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
            >
              Novo usuário
            </button>
          ) : null}
        </section>

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {editing ? (
          <section className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">{editing === "new" ? "Novo usuário" : `Editar ${form.name}`}</h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">E-mail (login)</span>
                <input
                  value={form.email}
                  disabled={editing !== "new"}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Papel</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={inputClass}>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {selectedRole ? <span className="mt-1 block text-xs text-slate-500">{selectedRole.description}</span> : null}
              </label>

              <label>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                  {editing === "new" ? "Senha inicial (mín. 8)" : "Nova senha (deixe vazio para manter)"}
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputClass}
                />
              </label>

              <div className="md:col-span-2">
                <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
                  Lojas {selectedRole?.needsStores ? "(obrigatório)" : "(opcional — dono da rede já vê todas)"}
                </span>
                <div className="flex flex-wrap gap-2">
                  {stores.map((store) => {
                    const on = form.storeIds.includes(store.id);
                    return (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => toggleStore(store.id)}
                        className={[
                          "rounded-full border px-4 py-2 text-sm font-bold transition",
                          on ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {on ? "✓ " : ""}
                        {store.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editing !== "new" ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  <span className="text-sm font-bold text-slate-800">Ativo (desmarque para bloquear o acesso)</span>
                </label>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? "Salvando..." : editing === "new" ? "Criar usuário" : "Salvar"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
                Cancelar
              </button>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Carregando...</p>
          ) : visibleUsers.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Nenhum usuário.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleUsers.map((user) => (
                <li key={user.id} className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-900">{user.name}</strong>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                        {user.role ? ROLE_LABELS[user.role] : "Papel desconhecido"}
                      </span>
                      {!user.active ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">Bloqueado</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
                    {user.stores.length > 0 ? (
                      <p className="mt-0.5 text-xs text-slate-500">Lojas: {user.stores.map((s) => s.name).join(", ")}</p>
                    ) : null}
                  </div>
                  {user.canEdit ? (
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
