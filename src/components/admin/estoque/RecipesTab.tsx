"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-auth";
import {
  Notice,
  QtyInput,
  cardClass,
  formatQuantity,
  fromBase,
  ghostButton,
  inputClass,
  primaryButton,
  toBase,
  costOf,
  money,
} from "@/components/admin/estoque/shared";

type Line = { id?: string; ingredientId: string; quantity: number };
type Product = { id: string; name: string; category: string; price_cents: number; recipeItems: Line[] };
type OptionItem = { id: string; name: string; price_cents: number; stockFactor: number | null; recipeItems: Line[] };
type Group = { slug: string; name: string; kind: string | null; items: OptionItem[] };
type Ingredient = { id: string; name: string; unit: string; costCents: number | null };

type Target = {
  type: "product" | "option";
  id: string;
  name: string;
  kind?: string | null;
  stockFactor?: number | null;
  priceCents?: number;
  category?: string;
  lines: Line[];
};
type EditLine = { ingredientId: string; text: string; big: boolean };

const KIND_HELP: Record<string, string> = {
  size: "Tamanho: a proporção multiplica a ficha da pizza (broto 0,5 · grande 1 · família 1,3). Insumos contados em unidade, como a bolinha de massa, não mudam. A ficha do tamanho é o que ele gasta a mais, por exemplo a caixa.",
  border: "O que a borda gasta, por exemplo Catupiry 60 g. Vale para qualquer tamanho.",
  dough: "O que esta massa gasta a mais, se gastar.",
  drink: "Bebida vendida junto da pizza: normalmente 1 un do insumo da bebida.",
  filling: "O que este recheio de batata gasta.",
};

export default function RecipesTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [factor, setFactor] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/stock/recipes");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao carregar a ficha técnica.");
      setProducts(data.products);
      setGroups(data.groups);
      setIngredients(data.ingredients);
      return data as { products: Product[]; groups: Group[] };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a ficha técnica.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unitOf = useMemo(() => new Map(ingredients.map((i) => [i.id, i.unit])), [ingredients]);
  const nameOf = useMemo(() => new Map(ingredients.map((i) => [i.id, i.name])), [ingredients]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) map.set(p.category || "outros", [...(map.get(p.category || "outros") || []), p]);
    return Array.from(map.entries());
  }, [products]);

  function select(next: Target) {
    setTarget(next);
    setSuccess("");
    setError("");
    setFactor(next.stockFactor ? String(next.stockFactor).replace(".", ",") : "");
    setLines(
      next.lines.map((l) => {
        const unit = unitOf.get(l.ingredientId) || "g";
        const shown = fromBase(l.quantity, unit);
        return { ingredientId: l.ingredientId, text: shown.text, big: shown.big };
      })
    );
  }

  function summary(list: Line[]) {
    if (list.length === 0) return "sem ficha";
    return list
      .slice(0, 3)
      .map((l) => `${nameOf.get(l.ingredientId) || "?"} ${formatQuantity(l.quantity, unitOf.get(l.ingredientId) || "g")}`)
      .join(", ") + (list.length > 3 ? "…" : "");
  }

  const costById = useMemo(() => new Map(ingredients.map((i) => [i.id, i.costCents])), [ingredients]);

  /** Custo (centavos) de linhas da ficha; factor = proporcao do tamanho (unidades nao mudam). */
  function linesCost(list: { ingredientId: string; quantity: number }[], factor = 1) {
    let total = 0;
    for (const l of list) {
      const unit = unitOf.get(l.ingredientId) || "g";
      total += costOf(l.quantity * (unit === "un" ? 1 : factor), unit, costById.get(l.ingredientId));
    }
    return total;
  }

  // Linhas como estao na tela agora (o custo acompanha a edicao).
  const editingLines = lines
    .filter((l) => l.ingredientId && l.text.trim())
    .map((l) => ({ ingredientId: l.ingredientId, quantity: toBase(l.text, unitOf.get(l.ingredientId) || "g", l.big) }))
    .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);
  const missingCost = editingLines.filter((l) => costById.get(l.ingredientId) == null).length;

  const sizeGroup = (() => {
    if (!target || target.type !== "product") return null;
    const cat = (target.category || "").toLowerCase();
    const slug = cat.includes("batata") ? "batata-tamanho" : cat.includes("pizza") ? "pizza-tamanho" : null;
    return slug ? groups.find((g) => g.slug === slug) || null : null;
  })();

  function marginLabel(price: number, cost: number) {
    if (price <= 0) return "—";
    return `${Math.round(((price - cost) / price) * 100)}%`;
  }

  async function save() {
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      const payloadLines = lines
        .filter((l) => l.ingredientId && l.text.trim())
        .map((l) => {
          const quantity = toBase(l.text, unitOf.get(l.ingredientId) || "g", l.big);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Quantidade inválida em ${nameOf.get(l.ingredientId)}.`);
          return { ingredientId: l.ingredientId, quantity };
        });

      const res = await fetchWithAuth("/api/admin/stock/recipes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target.type === "product" ? { productId: target.id, lines: payloadLines } : { optionItemId: target.id, lines: payloadLines }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar a ficha.");

      if (target.kind === "size") {
        const raw = factor.trim().replace(",", ".");
        const res2 = await fetchWithAuth("/api/admin/stock/recipes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionItemId: target.id, stockFactor: raw === "" ? null : Number(raw) }),
        });
        const data2 = await res2.json();
        if (!res2.ok || !data2?.ok) throw new Error(data2?.error || "Erro ao salvar a proporção.");
      }

      setSuccess(`Ficha de ${target.name} salva.`);
      const fresh = await load();
      if (fresh) {
        const updated =
          target.type === "product"
            ? fresh.products.find((p) => p.id === target.id)
            : fresh.groups.flatMap((g) => g.items).find((i) => i.id === target.id);
        if (updated) setTarget({ ...target, lines: updated.recipeItems, stockFactor: "stockFactor" in updated ? updated.stockFactor : null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a ficha.");
    } finally {
      setSaving(false);
    }
  }

  const itemButton = (active: boolean) =>
    [
      "w-full rounded-xl px-3 py-2 text-left transition",
      active ? "bg-orange-50 ring-1 ring-orange-300" : "hover:bg-slate-50",
    ].join(" ");

  if (loading && products.length === 0) return <p className="text-sm text-slate-500">Carregando...</p>;

  return (
    <div className="flex flex-col gap-4">
      {ingredients.length === 0 ? (
        <Notice kind="error">Cadastre os insumos primeiro (aba Insumos). Depois volte aqui para montar as fichas.</Notice>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {success ? <Notice kind="success">{success}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className={`${cardClass} max-h-[70vh] overflow-y-auto`}>
          <p className="mb-2 text-xs font-bold text-slate-500">Produtos</p>
          {productsByCategory.map(([category, list]) => (
            <div key={category} className="mb-3">
              <p className="px-3 pb-1 text-xs font-bold capitalize text-slate-400">{category}</p>
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    select({ type: "product", id: p.id, name: p.name, priceCents: p.price_cents, category: p.category, lines: p.recipeItems })
                  }
                  className={itemButton(target?.id === p.id)}
                >
                  <span className="block text-sm font-bold text-slate-900">{p.name}</span>
                  <span className={["block truncate text-xs", p.recipeItems.length ? "text-slate-500" : "text-amber-600"].join(" ")}>
                    {summary(p.recipeItems)}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {groups.map((g) => (
            <div key={g.slug} className="mb-3">
              <p className="px-3 pb-1 text-xs font-bold text-slate-400">Opções: {g.name}</p>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    select({ type: "option", id: item.id, name: item.name, kind: g.kind, stockFactor: item.stockFactor, lines: item.recipeItems })
                  }
                  className={itemButton(target?.id === item.id)}
                >
                  <span className="block text-sm font-bold text-slate-900">{item.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {g.kind === "size" ? `proporção ${item.stockFactor ?? 1}` : summary(item.recipeItems)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </section>

        <section className={cardClass}>
          {!target ? (
            <div className="text-sm text-slate-600">
              <p className="font-bold text-slate-900">Escolha um produto à esquerda.</p>
              <p className="mt-2">
                A ficha diz quanto cada venda gasta. Monte a pizza no tamanho de referência (proporção 1, normalmente a grande).
                Os outros tamanhos usam a proporção deles, e no meio a meio cada sabor gasta metade da própria ficha.
                A baixa acontece quando o pedido entra em preparo e volta se o pedido for cancelado.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{target.name}</h3>
                {target.kind ? <p className="mt-1 text-sm text-slate-500">{KIND_HELP[target.kind]}</p> : null}
              </div>

              {target.kind === "size" ? (
                <label className="max-w-xs">
                  <span className="mb-1 block text-xs font-bold text-slate-500">Proporção (vazio = 1)</span>
                  <input value={factor} onChange={(e) => setFactor(e.target.value)} inputMode="decimal" placeholder="Ex.: 0,5" className={inputClass} />
                </label>
              ) : null}

              <div className="flex flex-col gap-2">
                {lines.length === 0 ? <p className="text-sm text-slate-500">Nenhum insumo nesta ficha.</p> : null}
                {lines.map((line, index) => {
                  const unit = unitOf.get(line.ingredientId) || "g";
                  return (
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                      <select
                        value={line.ingredientId}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...line, ingredientId: e.target.value, big: false };
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
                        placeholder="Ex.: 250"
                        ariaLabel="Quantidade"
                      />
                      <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} className={ghostButton}>
                        Tirar
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setLines([...lines, { ingredientId: "", text: "", big: false }])}
                  disabled={ingredients.length === 0}
                  className={`${ghostButton} self-start`}
                >
                  + Adicionar insumo
                </button>
              </div>

              {target.type === "product" && editingLines.length > 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-900">Custo e margem</p>
                  {sizeGroup && sizeGroup.items.length > 0 ? (
                    <table className="mt-2 w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs font-bold text-slate-500">
                          <th className="py-1">Tamanho</th>
                          <th className="py-1">Custo</th>
                          <th className="py-1">Preço</th>
                          <th className="py-1">Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sizeGroup.items.map((size) => {
                          const cost = linesCost(editingLines, size.stockFactor ?? 1) + linesCost(size.recipeItems);
                          const price = (target.priceCents || 0) + size.price_cents;
                          return (
                            <tr key={size.id} className="border-t border-slate-200">
                              <td className="py-1.5 text-slate-700">{size.name}</td>
                              <td className="py-1.5 font-bold text-slate-900">{money(Math.round(cost))}</td>
                              <td className="py-1.5 text-slate-700">{money(price)}</td>
                              <td className="py-1.5 font-bold text-emerald-700">{marginLabel(price, cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">
                      Custo {money(Math.round(linesCost(editingLines)))} · preço {money(target.priceCents || 0)} · margem{" "}
                      <strong className="text-emerald-700">{marginLabel(target.priceCents || 0, linesCost(editingLines))}</strong>
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Borda, massa e bebidas somam o custo delas quando escolhidas. Preço sem promoção.
                    {missingCost > 0 ? ` ${missingCost} insumo(s) sem custo cadastrado ficam fora da conta.` : ""}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={saving} className={primaryButton}>
                  {saving ? "Salvando..." : "Salvar ficha"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
