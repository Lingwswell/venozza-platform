"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import { can, type Role } from "@/lib/auth/roles";
import {
  Notice,
  QtyInput,
  SUPPLY_STATUS,
  bigUnit,
  cardClass,
  formatQuantity,
  ghostButton,
  inputClass,
  primaryButton,
  toBase,
} from "@/components/admin/estoque/shared";

type Request = {
  id: string;
  status: string;
  origin: string;
  note: string | null;
  createdAt: string;
  store: { id: string; name: string };
  items: {
    id: string;
    quantityRequested: number;
    quantitySent: number | null;
    ingredient: { id: string; name: string; unit: string };
  }[];
};
type Ingredient = { id: string; name: string; unit: string; active: boolean };
type Location = { id: string; name: string; central: boolean };
type NewLine = { ingredientId: string; text: string; big: boolean };

export default function SupplyTab({ role }: { role: Role | null }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [stores, setStores] = useState<Location[]>([]);
  const [canRequest, setCanRequest] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [lines, setLines] = useState<NewLine[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (open: boolean) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/stock/supply${open ? "?open=1" : ""}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar os pedidos.");
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    // Lojas onde o usuario pode pedir e lista de insumos.
    Promise.all([
      fetchWithAuth("/api/admin/stock").then((r) => r.json()),
      fetchWithAuth("/api/admin/stock/ingredients").then((r) => r.json()),
    ])
      .then(([stock, ing]) => {
        if (stock?.ok) {
          const list = (stock.locations as Location[]).filter((l) => !l.central);
          setStores(list);
          setStoreId(list[0]?.id || "");
          // Quem edita o estoque de loja pode pedir a central (o servidor confere de novo).
          setCanRequest(list.length > 0 && can.manageStoreStock(role));
        }
        if (ing?.ok) setIngredients((ing.ingredients as Ingredient[]).filter((i) => i.active));
      })
      .catch(() => undefined);
  }, [load, role]);

  async function cancel(request: Request) {
    if (!window.confirm(`Cancelar o pedido de ${request.store.name}?`)) return;
    setError("");
    const res = await fetchWithAuth(`/api/admin/stock/supply/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) setError(data?.error || "Erro ao cancelar.");
    else setSuccess("Pedido cancelado.");
    await load(onlyOpen);
  }

  async function create() {
    setSaving(true);
    setError("");
    try {
      const unitOf = new Map(ingredients.map((i) => [i.id, i.unit]));
      const items = lines
        .filter((l) => l.ingredientId && l.text.trim())
        .map((l) => {
          const quantity = toBase(l.text, unitOf.get(l.ingredientId) || "g", l.big);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantidade inválida.");
          return { ingredientId: l.ingredientId, quantity };
        });
      const res = await fetchWithAuth("/api/admin/stock/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, items, note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao criar o pedido.");
      setSuccess("Pedido enviado para a cozinha central.");
      setCreating(false);
      setLines([]);
      setNote("");
      await load(onlyOpen);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardClass} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
        <p className="max-w-2xl text-sm text-slate-600">
          Quando um insumo da loja passa do mínimo, o pedido para a cozinha central é criado sozinho, com a quantidade
          sugerida. A loja também pode pedir na mão, por exemplo antes de um feriado.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !onlyOpen;
              setOnlyOpen(next);
              load(next);
            }}
            className={ghostButton}
          >
            {onlyOpen ? "Ver todos" : "Só em andamento"}
          </button>
          {canRequest ? (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setSuccess("");
                setLines([{ ingredientId: "", text: "", big: false }]);
              }}
              className={primaryButton}
            >
              Pedir à central
            </button>
          ) : null}
        </div>
      </section>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {success ? <Notice kind="success">{success}</Notice> : null}

      {creating ? (
        <section className={`${cardClass} border-orange-200`}>
          <h3 className="text-base font-black text-slate-900">Pedido manual para a cozinha central</h3>
          <div className="mt-3 flex flex-col gap-3">
            <label className="max-w-sm">
              <span className="mb-1 block text-xs font-bold text-slate-500">Loja</span>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={inputClass}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {lines.map((line, index) => {
              const unit = ingredients.find((i) => i.id === line.ingredientId)?.unit || "g";
              return (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                  <select
                    value={line.ingredientId}
                    onChange={(e) => {
                      const next = [...lines];
                      const u = ingredients.find((i) => i.id === e.target.value)?.unit || "g";
                      next[index] = { ...line, ingredientId: e.target.value, big: bigUnit(u) !== null };
                      setLines(next);
                    }}
                    className={inputClass}
                    aria-label="Insumo"
                  >
                    <option value="">Escolha o insumo</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <QtyInput
                    unit={unit}
                    text={line.text}
                    big={line.big}
                    onText={(v) => {
                      const next = [...lines];
                      next[index] = { ...line, text: v };
                      setLines(next);
                    }}
                    onBig={(v) => {
                      const next = [...lines];
                      next[index] = { ...line, big: v };
                      setLines(next);
                    }}
                    ariaLabel="Quantidade"
                  />
                  <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} className={ghostButton}>
                    Tirar
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => setLines([...lines, { ingredientId: "", text: "", big: false }])} className={`${ghostButton} self-start`}>
              + Adicionar insumo
            </button>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Observação para a central (opcional)" className={inputClass} />
            <div className="flex gap-2">
              <button type="button" onClick={create} disabled={saving} className={primaryButton}>
                {saving ? "Enviando..." : "Enviar pedido"}
              </button>
              <button type="button" onClick={() => setCreating(false)} className={ghostButton}>
                Cancelar
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : requests.length === 0 ? (
          <p className={`${cardClass} text-sm text-slate-500 md:col-span-2`}>
            {onlyOpen ? "Nenhum pedido em andamento. Tudo acima do mínimo." : "Nenhum pedido ainda."}
          </p>
        ) : (
          requests.map((r) => {
            const st = SUPPLY_STATUS[r.status] || { text: r.status, className: "bg-slate-100 text-slate-500" };
            return (
              <article key={r.id} className={cardClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-slate-900">{r.store.name}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.className}`}>{st.text}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {r.origin === "alerta" ? "Automático (abaixo do mínimo)" : "Pedido manual"} ·{" "}
                  {new Date(r.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {r.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="text-slate-700">{item.ingredient.name}</span>
                      <span className="font-bold text-slate-900">{formatQuantity(item.quantityRequested, item.ingredient.unit)}</span>
                    </li>
                  ))}
                </ul>
                {r.note ? <p className="mt-2 text-xs text-slate-500">{r.note}</p> : null}
                {r.status === "aberto" && canRequest ? (
                  <button type="button" onClick={() => cancel(r)} className={`${ghostButton} mt-3 text-rose-600`}>
                    Cancelar pedido
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
