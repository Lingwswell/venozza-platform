import { costOf } from "@/lib/stock/consumption";

// Conta do relatorio de estoque (pura). Valores de custo em centavos.

export type MovementSum = { location: string; ingredientId: string; type: string; quantity: number };
export type IngredientInfo = { id: string; name: string; unit: string; costCents: number | null };

export type IngredientReport = {
  ingredientId: string;
  name: string;
  unit: string;
  hasCost: boolean;
  used: number; // gasto pelas vendas (ja descontados os cancelados)
  lost: number; // perdas lancadas
  countDiff: number; // diferenca das contagens (negativo = faltou)
  received: number; // entradas + abastecimento recebido (na central: entradas)
  usedCents: number;
  lostCents: number;
  countDiffCents: number;
};

export type LocationTotals = {
  usedCents: number; // CMV teorico
  lostCents: number; // perdas lancadas
  countDiffCents: number; // diferenca de contagem (negativo = faltou)
  missingCost: number; // insumos com movimento e sem custo
};

export function buildLocationReport(sums: MovementSum[], ingredients: IngredientInfo[], location: string) {
  const info = new Map(ingredients.map((i) => [i.id, i]));
  const rows = new Map<string, IngredientReport>();

  for (const s of sums) {
    if (s.location !== location) continue;
    const ing = info.get(s.ingredientId);
    if (!ing) continue;
    let row = rows.get(ing.id);
    if (!row) {
      row = {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        hasCost: typeof ing.costCents === "number",
        used: 0,
        lost: 0,
        countDiff: 0,
        received: 0,
        usedCents: 0,
        lostCents: 0,
        countDiffCents: 0,
      };
      rows.set(ing.id, row);
    }
    const q = s.quantity || 0;
    if (s.type === "venda" || s.type === "estorno") row.used += -q;
    else if (s.type === "perda") row.lost += -q;
    else if (s.type === "contagem" || s.type === "ajuste") row.countDiff += q;
    else if (s.type === "entrada" || (s.type === "abastecimento" && q > 0)) row.received += q;
  }

  const totals: LocationTotals = { usedCents: 0, lostCents: 0, countDiffCents: 0, missingCost: 0 };
  for (const row of rows.values()) {
    const ing = info.get(row.ingredientId)!;
    row.used = round(row.used);
    row.lost = round(row.lost);
    row.countDiff = round(row.countDiff);
    row.received = round(row.received);
    row.usedCents = Math.round(costOf(row.used, ing.unit, ing.costCents));
    row.lostCents = Math.round(costOf(row.lost, ing.unit, ing.costCents));
    row.countDiffCents = Math.round(costOf(row.countDiff, ing.unit, ing.costCents));
    totals.usedCents += row.usedCents;
    totals.lostCents += row.lostCents;
    totals.countDiffCents += row.countDiffCents;
    if (!row.hasCost && (row.used || row.lost || row.countDiff)) totals.missingCost += 1;
  }

  const list = Array.from(rows.values()).sort(
    (a, b) => b.usedCents + b.lostCents - b.countDiffCents - (a.usedCents + a.lostCents - a.countDiffCents) || a.name.localeCompare(b.name)
  );
  return { rows: list, totals };
}

/** Perda total em centavos: perdas lancadas + o que faltou na contagem (sobra nao abate). */
export function totalLossCents(t: LocationTotals) {
  return t.lostCents + Math.max(-t.countDiffCents, 0);
}

export function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
