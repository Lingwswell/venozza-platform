"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import {
  MOVEMENT_LABELS,
  Notice,
  QtyInput,
  bigUnit,
  cardClass,
  formatQuantity,
  fromBase,
  ghostButton,
  inputClass,
  primaryButton,
  toBase,
} from "@/components/admin/estoque/shared";

type Location = { id: string; name: string; central: boolean };
type Row = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min: number | null;
  ownMin: number | null;
  defaultMin: number | null;
  below: boolean;
};
type Movement = {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  ingredient: { name: string; unit: string };
};

type Action = { row: Row; kind: "entrada" | "perda" | "ajuste" | "minimo" };

const ACTION_TITLE: Record<Action["kind"], string> = {
  entrada: "Lançar entrada",
  perda: "Lançar perda",
  ajuste: "Acertar pela contagem",
  minimo: "Mínimo deste local",
};

export default function StockLevels({ onLocation }: { onLocation?: (id: string, list: Location[]) => void }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [text, setText] = useState("");
  const [big, setBig] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Movement[] | null>(null);

  const load = useCallback(
    async (wanted?: string) => {
      setLoading(true);
      setError("");
      try {
        const qs = wanted ? `?location=${encodeURIComponent(wanted)}` : "";
        const res = await fetchWithAuth(`/api/admin/stock${qs}`);
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar o estoque.");
        setLocations(data.locations);
        setLocation(data.location);
        setRows(data.rows);
        setCanEdit(data.canEdit);
        onLocation?.(data.location, data.locations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar o estoque.");
      } finally {
        setLoading(false);
      }
    },
    [onLocation]
  );

  useEffect(() => {
    load();
    // so na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAction(row: Row, kind: Action["kind"]) {
    setAction({ row, kind });
    setSuccess("");
    setError("");
    setNote("");
    // Entrada e perda comecam em kg/L (peca de 2 kg); acerto e minimo mostram o valor atual.
    const start =
      kind === "ajuste"
        ? fromBase(row.quantity, row.unit)
        : kind === "minimo"
          ? fromBase(row.ownMin, row.unit)
          : { text: "", big: bigUnit(row.unit) !== null };
    setText(start.text);
    setBig(start.big);
  }

  async function saveAction() {
    if (!action) return;
    setSaving(true);
    setError("");
    try {
      const value = text.trim() === "" ? null : toBase(text, action.row.unit, big);
      if (value !== null && !Number.isFinite(value)) throw new Error("Número inválido.");

      const isMin = action.kind === "minimo";
      const res = await fetchWithAuth("/api/admin/stock", {
        method: isMin ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isMin
            ? { location, ingredientId: action.row.id, minQuantity: value }
            : { location, ingredientId: action.row.id, type: action.kind, quantity: value, note }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar.");
      setSuccess(`${action.row.name}: ${ACTION_TITLE[action.kind].toLowerCase()} salvo.`);
      setAction(null);
      await load(location);
      if (history) await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory() {
    const res = await fetchWithAuth(`/api/admin/stock/movements?location=${encodeURIComponent(location)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) setHistory(data.movements);
    else setError(data?.error || "Erro ao carregar o histórico.");
  }

  const lowCount = rows.filter((r) => r.below).length;
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.below) &&
      (!search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardClass} flex flex-col gap-3 md:flex-row md:items-end`}>
        <label className="md:w-72">
          <span className="mb-1 block text-xs font-bold text-slate-500">Local</span>
          <select
            value={location}
            onChange={(e) => {
              setHistory(null);
              setAction(null);
              load(e.target.value);
            }}
            className={inputClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-bold text-slate-500">Buscar insumo</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} placeholder="Ex.: mussarela" />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`${ghostButton} ${filter === "all" ? "border-orange-400 bg-orange-50" : ""}`}
          >
            Todos ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("low")}
            className={`${ghostButton} ${filter === "low" ? "border-rose-400 bg-rose-50" : ""} ${lowCount ? "text-rose-700" : ""}`}
          >
            Abaixo do mínimo ({lowCount})
          </button>
        </div>
      </section>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {success ? <Notice kind="success">{success}</Notice> : null}

      {action ? (
        <section className={`${cardClass} border-orange-200`}>
          <h3 className="text-base font-black text-slate-900">
            {ACTION_TITLE[action.kind]}: {action.row.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {action.kind === "entrada" && "Compra, produção ou o que chegou da central fora do sistema."}
            {action.kind === "perda" && "Algo que estragou, caiu ou foi descartado."}
            {action.kind === "ajuste" &&
              `Informe quanto tem de verdade. O sistema mostra ${formatQuantity(action.row.quantity, action.row.unit)}; a diferença fica registrada no histórico.`}
            {action.kind === "minimo" &&
              (action.row.defaultMin !== null
                ? `Deixe vazio para usar o mínimo padrão do insumo (${formatQuantity(action.row.defaultMin, action.row.unit)}).`
                : "Abaixo disso o insumo aparece em vermelho. Vazio = sem alerta.")}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[260px_1fr_auto] md:items-end">
            <QtyInput
              unit={action.row.unit}
              text={text}
              big={big}
              onText={setText}
              onBig={setBig}
              ariaLabel="Quantidade"
              placeholder={action.kind === "minimo" ? "Ex.: 500" : "Ex.: 2"}
            />
            {action.kind !== "minimo" ? (
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Observação (opcional)" className={inputClass} />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={saveAction} disabled={saving} className={primaryButton}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button type="button" onClick={() => setAction(null)} className={ghostButton}>
                Cancelar
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={cardClass}>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum insumo cadastrado ainda. Cadastre na aba Insumos (por exemplo, Mussarela em gramas) e monte a ficha técnica dos produtos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
                  <th className="py-2 pr-3">Insumo</th>
                  <th className="py-2 pr-3">Tem</th>
                  <th className="py-2 pr-3">Mínimo</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className={["border-b border-slate-100", row.below ? "bg-rose-50/60" : ""].join(" ")}>
                    <td className="py-3 pr-3 font-bold text-slate-900">{row.name}</td>
                    <td className={["py-3 pr-3 font-black", row.below || row.quantity < 0 ? "text-rose-700" : "text-slate-900"].join(" ")}>
                      {formatQuantity(row.quantity, row.unit)}
                      {row.below ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold">abaixo do mínimo</span> : null}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {row.min !== null ? formatQuantity(row.min, row.unit) : "—"}
                      {row.ownMin === null && row.defaultMin !== null ? <span className="ml-1 text-xs text-slate-400">(padrão)</span> : null}
                    </td>
                    <td className="py-3 text-right">
                      {canEdit ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button type="button" onClick={() => openAction(row, "entrada")} className={ghostButton}>
                            Entrada
                          </button>
                          <button type="button" onClick={() => openAction(row, "perda")} className={ghostButton}>
                            Perda
                          </button>
                          <button type="button" onClick={() => openAction(row, "ajuste")} className={ghostButton}>
                            Acertar
                          </button>
                          <button type="button" onClick={() => openAction(row, "minimo")} className={ghostButton}>
                            Mínimo
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">Histórico</h3>
          <button type="button" onClick={() => (history ? setHistory(null) : loadHistory())} className={ghostButton}>
            {history ? "Esconder" : "Ver últimos lançamentos"}
          </button>
        </div>
        {history ? (
          history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nada lançado neste local ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {history.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <strong className="text-slate-900">{m.ingredient.name}</strong>{" "}
                    <span className="text-slate-500">· {MOVEMENT_LABELS[m.type] || m.type}</span>
                    {m.note ? <span className="text-slate-400"> · {m.note}</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={m.quantity < 0 ? "font-bold text-rose-700" : "font-bold text-emerald-700"}>
                      {m.quantity > 0 ? "+" : ""}
                      {formatQuantity(m.quantity, m.ingredient.unit)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
