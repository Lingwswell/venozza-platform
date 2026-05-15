"use client";

import { useEffect, useMemo, useState } from "react";

type AdminStore = {
  id: string;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  cidade?: string | null;
  estado?: string | null;
  uf?: string | null;
  active?: boolean | null;
  tenantId?: string | null;
};

type StoresResponse = {
  ok?: boolean;
  stores?: AdminStore[];
  data?: AdminStore[];
  items?: AdminStore[];
  currentStoreId?: string | null;
  selectedStoreId?: string | null;
  operatorStoreId?: string | null;
  error?: string;
  message?: string;
};

function getAuthToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_auth_token") ||
    localStorage.getItem("venozza_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function getLocalStoreId() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_store_id") ||
    localStorage.getItem("store_id") ||
    null
  );
}

function getLocalTenantId() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_tenant_id") ||
    localStorage.getItem("tenant_id") ||
    null
  );
}

function getLocalUserRole() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("venozza_user_role") ||
    localStorage.getItem("user_role") ||
    null
  );
}

function normalizeStores(payload: StoresResponse): AdminStore[] {
  if (Array.isArray(payload.stores)) return payload.stores;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function getStoreCity(store: AdminStore) {
  return store.city || store.cidade || "-";
}

function getStoreState(store: AdminStore) {
  return store.state || store.estado || store.uf || "-";
}

export default function AdminLojasPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStores() {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const localTenantId = getLocalTenantId();
      const localStoreId = getLocalStoreId();
      const localUserRole = getLocalUserRole();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (localTenantId) {
        headers["x-tenant-id"] = localTenantId;
      }

      if (localStoreId) {
        headers["x-store-id"] = localStoreId;
      }

      if (localUserRole) {
        headers["x-user-role"] = localUserRole;
      }

      const response = await fetch("/api/admin/stores", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as StoresResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            payload.message ||
            `Erro ao carregar lojas. HTTP ${response.status}`
        );
      }

      const nextStores = normalizeStores(payload);

      setStores(nextStores);
      setCurrentStoreId(
        payload.currentStoreId ||
          payload.selectedStoreId ||
          payload.operatorStoreId ||
          localStoreId ||
          null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao carregar lojas.");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  const activeStoresCount = useMemo(() => {
    return stores.filter((store) => store.active !== false).length;
  }, [stores]);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Administração</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            Lojas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Gerencie as lojas reais do tenant, visualize a loja atual do operador
            e prepare a estrutura para futuras ações de criação e edição.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadStores}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            Atualizar
          </button>

          <button
            type="button"
            disabled
            title="Em breve"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white opacity-50 shadow-sm"
          >
            Nova loja
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total de lojas</p>
          <p className="mt-2 text-3xl font-bold text-zinc-950">{stores.length}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Lojas ativas</p>
          <p className="mt-2 text-3xl font-bold text-zinc-950">{activeStoresCount}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Loja atual</p>
          <p className="mt-2 truncate text-sm font-semibold text-zinc-950">
            {currentStoreId || "Não identificada"}
          </p>
        </div>
      </section>

      {loading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Carregando lojas...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && stores.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Nenhuma loja encontrada.
        </div>
      )}

      {!loading && !error && stores.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-bold text-zinc-950">Lojas cadastradas</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Dados carregados diretamente de <code>/api/admin/stores</code>.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-600">
                    Loja
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-600">
                    Slug
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-600">
                    Cidade/UF
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-600">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-zinc-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100 bg-white">
                {stores.map((store) => {
                  const isCurrent = currentStoreId === store.id;

                  return (
                    <tr key={store.id} className={isCurrent ? "bg-emerald-50/60" : ""}>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-zinc-950">
                            {store.name || "Loja sem nome"}
                          </span>

                          <span className="text-xs text-zinc-500">
                            ID: {store.id}
                          </span>

                          {isCurrent && (
                            <span className="mt-1 w-fit rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Loja atual do operador
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-zinc-700">
                        {store.slug || "-"}
                      </td>

                      <td className="px-5 py-4 text-zinc-700">
                        {getStoreCity(store)}/{getStoreState(store)}
                      </td>

                      <td className="px-5 py-4">
                        {store.active === false ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                            Inativa
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Ativa
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          disabled
                          title="Edição será implementada em etapa futura"
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-500 opacity-60"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
