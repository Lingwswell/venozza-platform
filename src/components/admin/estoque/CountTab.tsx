"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import {
  Notice,
  QtyInput,
  bigUnit,
  cardClass,
  costOf,
  formatQuantity,
  ghostButton,
  inputClass,
  money,
  primaryButton,
  toBase,
} from "@/components/admin/estoque/shared";

type Location = { id: string; name: string; central: boolean };
type Row = { id: string; name: string; unit: string; quantity: number };
type Difference = {
  ingredientId: string;
  name: string;
  unit: string;
  expected: number;
  counted: number;
  diff: number;
  costCents: number | null;
};

// Contagem: a loja (ou a central) informa o que tem de verdade.
// So os insumos preenchidos entram; a diferenca vira o relatorio de perda.
export default function CountTab() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [values, setValues] = useState<Record<string, { text: string; big: boolean }>>({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Difference[] | null>(null);

  const load = useCallback(async (wanted?: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(`/api/admin/stock${wanted ? `?location=${encodeURIComponent(wanted)}` : ""}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar o estoque.");
      setLocations(data.locations);
      setLocation(data.location);
      setRows(data.rows);
      setCanEdit(data.canEdit);
      const start: Record<string, { text: string; big: boolean }> = {};
      for (const r of data.rows as Row[]) start[r.id] = { text: "", big: bigUnit(r.unit) !== null };
      setValues(start);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o estoque.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filled = rows.filter((r) => (values[r.id]?.text || "").trim() !== "");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const counts = filled.map((r) => {
        const v = values[r.id];
        const quantity = toBase(v.text, r.unit, v.big);
        if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Quantidade inválida em ${r.name}.`);
        return { ingredientId: r.id, quantity };
      });
      if (counts.length === 0) throw new Error("Preencha pelo menos um insumo.");
      const res = await fetchWithAuth("/api/admin/stock/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, counts, note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar a contagem.");
      setResult(data.differences);
      setNote("");
      await load(location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a contagem.");
    } finally {
      setSaving(false);
    }
  }

  const missingTotal = result
    ? result.reduce((sum, d) => sum + (d.diff < 0 ? costOf(-d.diff, d.unit, d.costCents) : 0), 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardClass} flex flex-col gap-3 md:flex-row md:items-end md:justify-between`}>
        <label className="md:w-72">
          <span className="mb-1 block text-xs font-bold text-slate-500">Local</span>
          <select
            value={location}
            onChange={(e) => {
              setResult(null);
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
        <p className="max-w-xl text-sm text-slate-600">
          Conte o que tem de verdade e preencha só o que contou. O sistema guarda a diferença para o que ele esperava:
          é ela que mostra a perda no relatório. Não precisa contar tudo no mesmo dia.
        </p>
      </section>

      {error ? <Notice kind="error">{error}</Notice> : null}

      {result ? (
        <section className={`${cardClass} border-emerald-200`}>
          <h3 className="text-base font-black text-slate-900">Contagem salva</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {result.map((d) => (
              <li key={d.ingredientId} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-bold text-slate-900">{d.name}</span>
                <span className="text-slate-600">
                  esperado {formatQuantity(d.expected, d.unit)} · contado {formatQuantity(d.counted, d.unit)} ·{" "}
                  <strong className={d.diff < 0 ? "text-rose-700" : d.diff > 0 ? "text-sky-700" : "text-emerald-700"}>
                    {d.diff === 0 ? "bateu" : `${d.diff > 0 ? "sobrou" : "faltou"} ${formatQuantity(Math.abs(d.diff), d.unit)}`}
                  </strong>
                </span>
              </li>
            ))}
          </ul>
          {missingTotal > 0 ? (
            <p className="mt-3 text-sm font-bold text-rose-700">Faltou o equivalente a {money(Math.round(missingTotal))}.</p>
          ) : null}
          <button type="button" onClick={() => setResult(null)} className={`${ghostButton} mt-3`}>
            Fechar
          </button>
        </section>
      ) : null}

      <section className={cardClass}>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum insumo cadastrado.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {rows.map((r) => {
                const v = values[r.id] || { text: "", big: false };
                return (
                  <div key={r.id} className="grid items-center gap-2 py-2 md:grid-cols-[1fr_180px_240px]">
                    <span className="font-bold text-slate-900">{r.name}</span>
                    <span className="text-sm text-slate-500">sistema: {formatQuantity(r.quantity, r.unit)}</span>
                    <QtyInput
                      unit={r.unit}
                      text={v.text}
                      big={v.big}
                      onText={(text) => setValues({ ...values, [r.id]: { ...v, text } })}
                      onBig={(big) => setValues({ ...values, [r.id]: { ...v, big } })}
                      placeholder="contado"
                      ariaLabel={`Quantidade contada de ${r.name}`}
                    />
                  </div>
                );
              })}
            </div>
            {canEdit ? (
              <div className="mt-4 flex flex-col gap-2 md:flex-row">
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Observação (ex.: contagem de sexta)" className={inputClass} />
                <button type="button" onClick={save} disabled={saving || filled.length === 0} className={`${primaryButton} shrink-0`}>
                  {saving ? "Salvando..." : `Salvar contagem (${filled.length})`}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Seu papel só consulta este local.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
