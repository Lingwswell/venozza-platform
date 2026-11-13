"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { parseCoordinates } from "@/lib/geo";

type AdminStore = {
  id: string;
  name: string;
  slug: string;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryRadiusKm: number | null;
  active: boolean;
};

type FormState = {
  name: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: string;
  deliveryRadiusKm: string;
  active: boolean;
  copyFromStoreId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  coordinates: "",
  deliveryRadiusKm: "",
  active: true,
  copyFromStoreId: "",
};

function toForm(store: AdminStore): FormState {
  return {
    name: store.name,
    addressStreet: store.addressStreet || "",
    addressNumber: store.addressNumber || "",
    addressComplement: store.addressComplement || "",
    addressNeighborhood: store.addressNeighborhood || "",
    city: store.city || "",
    state: store.state || "",
    zipCode: store.zipCode || "",
    coordinates:
      store.latitude !== null && store.longitude !== null
        ? `${store.latitude}, ${store.longitude}`
        : "",
    deliveryRadiusKm: store.deliveryRadiusKm !== null ? String(store.deliveryRadiusKm) : "",
    active: store.active,
    copyFromStoreId: "",
  };
}

function addressLine(store: AdminStore) {
  const street = [store.addressStreet, store.addressNumber].filter(Boolean).join(", ");
  const place = [store.addressNeighborhood, store.city, store.state].filter(Boolean).join(" · ");
  return [street, place].filter(Boolean).join(" — ") || "Endereço não cadastrado";
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400";

export default function LojasPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const canManage = role === "owner" || role === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth("/api/admin/stores?all=1");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar lojas.");
      setStores(Array.isArray(data.stores) ? data.stores : []);
      setRole(String(data.role || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar lojas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Busca endereco + coordenadas pelo CEP. Com numero, refina a localizacao.
  async function lookupByCep(cepValue: string, number: string, street: string, fillAddress: boolean) {
    const cep = cepValue.replace(/\D/g, "");
    if (cep.length !== 8) return;

    setLookingUp(true);
    setLookupMessage("Buscando endereço...");
    try {
      const params = new URLSearchParams({ cep });
      if (number.trim()) params.set("number", number.trim());
      if (!fillAddress && street.trim()) params.set("street", street.trim());

      const res = await fetchWithAuth(`/api/admin/address-lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "CEP não encontrado.");

      const a = data.address as {
        zipCode: string;
        street: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        latitude: number | null;
        longitude: number | null;
        precision: "number" | "street" | "zip" | null;
      };

      setForm((current) => ({
        ...current,
        zipCode: a.zipCode,
        ...(fillAddress
          ? {
              addressStreet: a.street || current.addressStreet,
              addressNeighborhood: a.neighborhood || current.addressNeighborhood,
              city: a.city || current.city,
              state: a.state || current.state,
            }
          : {}),
        coordinates:
          a.latitude !== null && a.longitude !== null ? `${a.latitude}, ${a.longitude}` : current.coordinates,
      }));

      setLookupMessage(
        a.precision === "number"
          ? "Endereço e localização encontrados pelo número. Confira no mapa."
          : a.precision === "street"
            ? "Localização encontrada pela rua. Preencha o número para ficar mais precisa."
            : a.precision === "zip"
              ? "Localização aproximada (bairro). Preencha o número ou ajuste no mapa."
              : "Endereço preenchido, mas a localização não foi encontrada. Cole as coordenadas do Google Maps."
      );
    } catch (err) {
      setLookupMessage(err instanceof Error ? err.message : "Não foi possível buscar o CEP.");
    } finally {
      setLookingUp(false);
    }
  }

  function onCepChange(value: string) {
    update("zipCode", value);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8 && digits !== form.zipCode.replace(/\D/g, "")) {
      lookupByCep(digits, form.addressNumber, "", true);
    }
  }

  function startEdit(store: AdminStore) {
    setEditingId(store.id);
    setForm(toForm(store));
    setLookupMessage("");
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startCreate() {
    setEditingId("new");
    setLookupMessage("");
    setForm({ ...EMPTY_FORM, copyFromStoreId: stores.find((s) => s.active)?.id || "" });
    setError("");
    setSuccess("");
  }

  function fillWithMyLocation() {
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      setError(
        "O navegador só libera a localização em HTTPS. Cole as coordenadas do Google Maps (clique com o botão direito no local → primeira linha)."
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        update("coordinates", `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
      },
      () => {
        setLocating(false);
        setError("Não foi possível pegar a localização deste aparelho.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save() {
    setError("");
    setSuccess("");

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (form.coordinates.trim()) {
      const parsed = parseCoordinates(form.coordinates);
      if (!parsed) {
        setError("Coordenadas inválidas. Use o formato: -23.550520, -46.633308");
        return;
      }
      [latitude, longitude] = parsed;
    }

    const body: Record<string, unknown> = {
      name: form.name,
      addressStreet: form.addressStreet,
      addressNumber: form.addressNumber,
      addressComplement: form.addressComplement,
      addressNeighborhood: form.addressNeighborhood,
      city: form.city,
      state: form.state,
      zipCode: form.zipCode,
      latitude,
      longitude,
      deliveryRadiusKm: form.deliveryRadiusKm.trim() || null,
      active: form.active,
    };
    if (editingId === "new" && form.copyFromStoreId) body.copyFromStoreId = form.copyFromStoreId;

    setSaving(true);
    try {
      const send = (payload: Record<string, unknown>) =>
        fetchWithAuth(editingId === "new" ? "/api/admin/stores" : `/api/admin/stores/${editingId}`, {
          method: editingId === "new" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      let res = await send(body);
      let data = await res.json();
      // Loja extra do plano: confirma o valor a mais na mensalidade.
      if (res.status === 409 && data?.code === "EXTRA_STORE_CONFIRM") {
        if (!window.confirm(`${data.error} Abrir a loja mesmo assim?`)) return;
        res = await send({ ...body, confirmExtra: true });
        data = await res.json();
      }
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar loja.");

      setSuccess(editingId === "new" ? "Loja criada." : "Loja salva.");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar loja.");
    } finally {
      setSaving(false);
    }
  }

  const coords = parseCoordinates(form.coordinates);

  return (
    <AdminShell title="Lojas" subtitle="Endereço, localização e área de entrega de cada loja da rede.">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-sm text-slate-600">
            O app usa a localização do celular para abrir a loja mais perto do cliente. Para isso cada
            loja precisa das <strong>coordenadas</strong> e, se quiser avisar quem está longe, do
            <strong> raio de entrega</strong>.
          </p>
          {canManage ? (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
            >
              Nova loja
            </button>
          ) : null}
        </section>

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        {editingId ? (
          <section className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">
              {editingId === "new" ? "Nova loja" : `Editar ${form.name}`}
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-6">
              <label className="md:col-span-5">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Nome</span>
                <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: VenoZza Centro" className={inputClass} />
              </label>
              <label className="flex items-end gap-2 pb-3 md:col-span-1">
                <input type="checkbox" checked={form.active} onChange={(e) => update("active", e.target.checked)} />
                <span className="text-sm font-bold text-slate-800">Ativa</span>
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">CEP</span>
                <input
                  value={form.zipCode}
                  onChange={(e) => onCepChange(e.target.value)}
                  inputMode="numeric"
                  placeholder="Digite o CEP"
                  className={inputClass}
                />
              </label>
              <label className="md:col-span-1">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Número</span>
                <input
                  value={form.addressNumber}
                  onChange={(e) => update("addressNumber", e.target.value)}
                  onBlur={() =>
                    form.addressNumber.trim() &&
                    lookupByCep(form.zipCode, form.addressNumber, form.addressStreet, false)
                  }
                  className={inputClass}
                />
              </label>
              <p className="self-end pb-3 text-xs font-semibold text-slate-500 md:col-span-3">
                {lookingUp ? "Buscando..." : lookupMessage || "O CEP preenche o endereço e a localização sozinho."}
              </p>

              <label className="md:col-span-5">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Rua</span>
                <input value={form.addressStreet} onChange={(e) => update("addressStreet", e.target.value)} className={inputClass} />
              </label>
              <label className="md:col-span-1">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Compl.</span>
                <input value={form.addressComplement} onChange={(e) => update("addressComplement", e.target.value)} className={inputClass} />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Bairro</span>
                <input value={form.addressNeighborhood} onChange={(e) => update("addressNeighborhood", e.target.value)} className={inputClass} />
              </label>
              <label className="md:col-span-3">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Cidade</span>
                <input value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
              </label>
              <label className="md:col-span-1">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">UF</span>
                <input value={form.state} maxLength={2} onChange={(e) => update("state", e.target.value)} className={inputClass} />
              </label>

              <label className="md:col-span-4">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                  Localização (preenchida pelo CEP — ajuste se precisar)
                </span>
                <input
                  value={form.coordinates}
                  onChange={(e) => update("coordinates", e.target.value)}
                  placeholder="-23.550520, -46.633308"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Para corrigir: no Google Maps, botão direito em cima da loja → clique na primeira linha (copia) → cole aqui.
                  {coords ? (
                    <>
                      {" "}
                      <a
                        href={`https://www.google.com/maps?q=${coords[0]},${coords[1]}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-orange-600 underline"
                      >
                        Conferir no mapa
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
              <div className="flex items-start pt-6 md:col-span-2">
                <button
                  type="button"
                  onClick={fillWithMyLocation}
                  disabled={locating}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {locating ? "Localizando..." : "Estou na loja: usar minha localização"}
                </button>
              </div>

              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Raio de entrega (km)</span>
                <input
                  value={form.deliveryRadiusKm}
                  onChange={(e) => update("deliveryRadiusKm", e.target.value)}
                  placeholder="Ex.: 5 (vazio = sem limite)"
                  className={inputClass}
                />
              </label>

              {editingId === "new" ? (
                <label className="md:col-span-4">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Cardápio inicial</span>
                  <select
                    value={form.copyFromStoreId}
                    onChange={(e) => update("copyFromStoreId", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Começar sem produtos</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        Copiar produtos, preços e estoque de {s.name}
                      </option>
                    ))}
                  </select>
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
                {saving ? "Salvando..." : editingId === "new" ? "Criar loja" : "Salvar loja"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Carregando...</p>
          ) : stores.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Nenhuma loja cadastrada.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stores.map((store) => {
                const hasCoords = store.latitude !== null && store.longitude !== null;
                return (
                  <li key={store.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-base text-slate-900">{store.name}</strong>
                        {!store.active ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Desativada</span>
                        ) : null}
                        {hasCoords ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Localização ok</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Sem localização</span>
                        )}
                        {store.deliveryRadiusKm ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                            Entrega até {store.deliveryRadiusKm} km
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{addressLine(store)}</p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => startEdit(store)}
                        className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
