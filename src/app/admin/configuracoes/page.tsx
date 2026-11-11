"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import {
  DAY_KEYS,
  DAY_LABELS,
  defaultOpeningHours,
  type OpeningHours,
  type OpenStatus,
  type StoreSettingsData,
} from "@/lib/store/settings-shared";

type AdminStore = { id: string; name: string };

type SettingsResponse = {
  ok?: boolean;
  error?: string;
  role?: string;
  store?: AdminStore;
  settings?: StoreSettingsData;
  status?: OpenStatus;
};

// Campos de dinheiro ficam como texto ("12,50") no formulario.
type FormState = {
  manualClosed: boolean;
  closedMessage: string;
  useHours: boolean;
  openingHours: OpeningHours;
  deliveryTimeMinMinutes: string;
  deliveryTimeMaxMinutes: string;
  deliveryFee: string;
  minimumOrder: string;
  freeDeliveryAbove: string;
  whatsapp: string;
  paymentPix: boolean;
  paymentCash: boolean;
  paymentCredit: boolean;
  paymentDebit: boolean;
};

function centsToInput(cents: number | null | undefined) {
  if (cents === null || typeof cents === "undefined") return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function inputToCents(value: string): number | null {
  const clean = value.replace(/[^\d,.-]/g, "").trim();
  if (!clean) return null;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

function toForm(s: StoreSettingsData): FormState {
  return {
    manualClosed: s.manualClosed,
    closedMessage: s.closedMessage || "",
    useHours: s.openingHours !== null,
    openingHours: s.openingHours || defaultOpeningHours(),
    deliveryTimeMinMinutes: String(s.deliveryTimeMinMinutes),
    deliveryTimeMaxMinutes: String(s.deliveryTimeMaxMinutes),
    deliveryFee: centsToInput(s.deliveryFeeCents),
    minimumOrder: centsToInput(s.minimumOrderCents),
    freeDeliveryAbove: centsToInput(s.freeDeliveryAboveCents),
    whatsapp: s.whatsapp || "",
    paymentPix: s.paymentPix,
    paymentCash: s.paymentCash,
    paymentCredit: s.paymentCredit,
    paymentDebit: s.paymentDebit,
  };
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400";

export default function ConfiguracoesPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [role, setRole] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<OpenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isOperator = role === "operator";

  useEffect(() => {
    fetchWithAuth("/api/admin/stores")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.stores)) setStores(data.stores);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async (targetStoreId: string) => {
    setLoading(true);
    setError("");
    try {
      const query = targetStoreId ? `?storeId=${encodeURIComponent(targetStoreId)}` : "";
      const res = await fetchWithAuth(`/api/admin/store-settings${query}`);
      const data: SettingsResponse = await res.json();

      if (!res.ok || !data.ok || !data.settings || !data.store) {
        throw new Error(data.error || "Erro ao carregar configurações.");
      }

      setRole(String(data.role || ""));
      setStoreId(data.store.id);
      setForm(toForm(data.settings));
      setStatus(data.status || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSuccess("");
  }

  function updateDay(day: (typeof DAY_KEYS)[number], patch: Partial<OpeningHours["mon"]>) {
    setForm((current) =>
      current
        ? {
            ...current,
            openingHours: {
              ...current.openingHours,
              [day]: { ...current.openingHours[day], ...patch },
            },
          }
        : current
    );
    setSuccess("");
  }

  async function save() {
    if (!form) return;
    setError("");
    setSuccess("");

    const deliveryFeeCents = inputToCents(form.deliveryFee) ?? 0;
    const minimumOrderCents = inputToCents(form.minimumOrder) ?? 0;
    const freeDeliveryAboveCents = inputToCents(form.freeDeliveryAbove);

    if ([deliveryFeeCents, minimumOrderCents, freeDeliveryAboveCents].some((v) => Number.isNaN(v))) {
      setError("Confira os valores em dinheiro (use o formato 12,50).");
      return;
    }

    const body = isOperator
      ? { storeId, manualClosed: form.manualClosed, closedMessage: form.closedMessage }
      : {
          storeId,
          manualClosed: form.manualClosed,
          closedMessage: form.closedMessage,
          openingHours: form.useHours ? form.openingHours : null,
          deliveryTimeMinMinutes: Number(form.deliveryTimeMinMinutes),
          deliveryTimeMaxMinutes: Number(form.deliveryTimeMaxMinutes),
          deliveryFeeCents,
          minimumOrderCents,
          freeDeliveryAboveCents,
          whatsapp: form.whatsapp,
          paymentPix: form.paymentPix,
          paymentCash: form.paymentCash,
          paymentCredit: form.paymentCredit,
          paymentDebit: form.paymentDebit,
        };

    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/store-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: SettingsResponse = await res.json();

      if (!res.ok || !data.ok || !data.settings) {
        throw new Error(data.error || "Erro ao salvar configurações.");
      }

      setForm(toForm(data.settings));
      setStatus(data.status || null);
      setSuccess("Configurações salvas. O app e o site já usam os novos valores.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Configurações"
      subtitle="Funcionamento, entrega e pagamentos de cada loja."
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {stores.length > 1 && !isOperator ? (
              <select
                value={storeId}
                onChange={(e) => load(e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="text-lg text-slate-900">
                {stores.find((s) => s.id === storeId)?.name || "Loja"}
              </strong>
            )}

            {status ? (
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  status.open ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {status.open ? "Aberta agora" : "Fechada agora"}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || loading || !form}
            className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </section>

        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p>
        ) : null}

        {loading || !form ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Loja aberta ou fechada</h3>
              <p className="mt-1 text-sm text-slate-500">
                Fechar manualmente bloqueia novos pedidos na hora, independente do horário.
              </p>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.manualClosed}
                  onChange={(e) => update("manualClosed", e.target.checked)}
                />
                <span className="text-sm font-bold text-slate-800">Fechar a loja agora</span>
              </label>

              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                  Mensagem para o cliente quando estiver fechada (opcional)
                </span>
                <input
                  value={form.closedMessage}
                  onChange={(e) => update("closedMessage", e.target.value)}
                  placeholder="Ex.: Voltamos amanhã às 18h!"
                  maxLength={200}
                  className={inputClass}
                />
              </label>
            </section>

            <fieldset disabled={isOperator} className="flex flex-col gap-6 disabled:opacity-60">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">Entrega</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tempo mínimo (min)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.deliveryTimeMinMinutes}
                      onChange={(e) => update("deliveryTimeMinMinutes", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tempo máximo (min)</span>
                    <input
                      type="number"
                      min={1}
                      value={form.deliveryTimeMaxMinutes}
                      onChange={(e) => update("deliveryTimeMaxMinutes", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">WhatsApp da loja</span>
                    <input
                      value={form.whatsapp}
                      onChange={(e) => update("whatsapp", e.target.value)}
                      placeholder="11999999999"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Taxa de entrega (R$)</span>
                    <input
                      value={form.deliveryFee}
                      onChange={(e) => update("deliveryFee", e.target.value)}
                      placeholder="5,00"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Pedido mínimo (R$)</span>
                    <input
                      value={form.minimumOrder}
                      onChange={(e) => update("minimumOrder", e.target.value)}
                      placeholder="0,00 = sem mínimo"
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Frete grátis acima de (R$)</span>
                    <input
                      value={form.freeDeliveryAbove}
                      onChange={(e) => update("freeDeliveryAbove", e.target.value)}
                      placeholder="Vazio = nunca"
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">Formas de pagamento</h3>
                <p className="mt-1 text-sm text-slate-500">Só as ativas aparecem no checkout. O pagamento é feito na entrega.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      ["paymentPix", "PIX"],
                      ["paymentCash", "Dinheiro"],
                      ["paymentCredit", "Cartão de crédito"],
                      ["paymentDebit", "Cartão de débito"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => update(key, e.target.checked)}
                      />
                      <span className="text-sm font-bold text-slate-800">{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Horário de funcionamento</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Fora do horário o app mostra “fechado” e não aceita pedidos. Fechamento depois da meia-noite: use, por exemplo, 18:00 até 00:30.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.useHours}
                      onChange={(e) => update("useHours", e.target.checked)}
                    />
                    Usar horário
                  </label>
                </div>

                {form.useHours ? (
                  <div className="mt-4 divide-y divide-slate-100">
                    {DAY_KEYS.map((day) => {
                      const hours = form.openingHours[day];
                      return (
                        <div key={day} className="flex flex-wrap items-center gap-3 py-3">
                          <label className="flex w-48 items-center gap-2 text-sm font-bold text-slate-800">
                            <input
                              type="checkbox"
                              checked={hours.active}
                              onChange={(e) => updateDay(day, { active: e.target.checked })}
                            />
                            {DAY_LABELS[day]}
                          </label>
                          {hours.active ? (
                            <>
                              <input
                                type="time"
                                value={hours.open}
                                onChange={(e) => updateDay(day, { open: e.target.value })}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                              />
                              <span className="text-sm text-slate-500">até</span>
                              <input
                                type="time"
                                value={hours.close}
                                onChange={(e) => updateDay(day, { close: e.target.value })}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                              />
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-slate-400">Fechado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Sem horário cadastrado: a loja fica aberta sempre, a menos que seja fechada manualmente.
                  </p>
                )}
              </section>
            </fieldset>
          </>
        )}
      </div>
    </AdminShell>
  );
}
