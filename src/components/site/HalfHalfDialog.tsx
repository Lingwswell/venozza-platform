"use client";

import { useMemo, useState } from "react";
import { addToCart } from "@/lib/cart-storage";
import { getMobileStoreContext } from "@/lib/mobile-store-context";
import { findFamilySize, pickOption, useOptionCatalog } from "@/lib/use-option-catalog";
import { buildHalfHalfItem, halfHalfUnitCents } from "@/lib/catalog/cart-items";
import type { CatalogProduct } from "@/lib/catalog/use-store-catalog";
import SiteDialog from "@/components/site/SiteDialog";
import Plate from "@/components/site/Plate";
import { AddBar, ChoiceGroup, DrinkCounters, focusRing, money } from "@/components/site/OptionPickers";
import { displayFont } from "@/lib/fonts";

// Pizza meio a meio dentro do site: 2 sabores, tamanho familia, borda, massa e bebidas.
export default function HalfHalfDialog({
  open,
  pizzas,
  onClose,
  onAdded,
}: {
  open: boolean;
  pizzas: CatalogProduct[];
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  return (
    <SiteDialog open={open} onClose={onClose} label="Pizza meio a meio">
      {open ? <HalfHalfForm pizzas={pizzas} onClose={onClose} onAdded={onAdded} /> : null}
    </SiteDialog>
  );
}

function HalfHalfForm({
  pizzas,
  onClose,
  onAdded,
}: {
  pizzas: CatalogProduct[];
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const { catalog, loading } = useOptionCatalog();
  const [flavorIds, setFlavorIds] = useState<string[]>([]);
  const [borderId, setBorderId] = useState("");
  const [doughId, setDoughId] = useState("");
  const [drinkQty, setDrinkQty] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const familySize = useMemo(() => findFamilySize(catalog.pizzaSizes), [catalog.pizzaSizes]);
  const border = pickOption(catalog.pizzaBorders, borderId);
  const dough = pickOption(catalog.pizzaDoughs, doughId);
  const drinks = useMemo(
    () =>
      catalog.pizzaDrinks
        .map((d) => ({ ...d, quantity: drinkQty[d.id] || 0 }))
        .filter((d) => d.quantity > 0),
    [catalog.pizzaDrinks, drinkQty]
  );

  const flavors = flavorIds
    .map((id) => pizzas.find((p) => p.id === id))
    .filter((p): p is CatalogProduct => !!p);

  const unitCents = halfHalfUnitCents({
    flavorPrices: flavors.map((f) => f.price_cents),
    familySize,
    border,
    dough,
    drinks,
  });

  function toggleFlavor(id: string) {
    setMessage("");
    setFlavorIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]
    );
  }

  function add() {
    if (flavors.length !== 2) {
      setMessage("Escolha 2 sabores para montar a pizza.");
      return;
    }
    const store = getMobileStoreContext();
    addToCart(
      buildHalfHalfItem({
        flavors: flavors.map((f) => ({ id: f.id, name: f.name, image: f.image })),
        familySize,
        border,
        dough,
        drinks,
        unitCents,
        quantity,
        note,
        store: { tenantId: store.tenantId, storeId: store.storeId },
      })
    );
    onAdded("Pizza meio a meio");
    onClose();
  }

  return (
    <>
      <div className="px-6 pb-6 pt-8">
        <h2 className={`${displayFont.className} pr-10 text-[28px] font-bold tracking-[-0.02em]`}>Pizza meio a meio</h2>
        <p className="mt-1 text-sm text-[#57534E]">
          {familySize ? `${familySize.name}. ` : ""}Escolha 2 sabores. O preço é o do sabor mais caro.
        </p>

        <fieldset className="mt-5">
          <legend className="text-base font-semibold text-[#1C1917]">
            Sabores <span className="font-normal text-[#8A8580]">({flavors.length} de 2)</span>
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pizzas.map((pizza) => {
              const on = flavorIds.includes(pizza.id);
              return (
                <button
                  key={pizza.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFlavor(pizza.id)}
                  className={[
                    focusRing,
                    "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors",
                    on ? "border-[#B91C1C] bg-[#FDF2F1]" : "border-[#E7E5E4] hover:border-[#D4C9BE]",
                  ].join(" ")}
                >
                  <Plate src={pizza.image} name={pizza.name} size={44} ring={2} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-[#1C1917]">{pizza.name}</span>
                    <span className="text-[#57534E]">{money(pizza.price_cents)}</span>
                  </span>
                  {on ? <span className="text-xs font-bold text-[#B91C1C]">{flavorIds.indexOf(pizza.id) + 1}ª metade</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 space-y-5">
          {loading ? <p className="text-sm text-[#8A8580]">Carregando opções...</p> : null}
          <ChoiceGroup title="Borda" name="borda-mm" options={catalog.pizzaBorders} value={border.id} onChange={setBorderId} />
          <ChoiceGroup title="Massa" name="massa-mm" options={catalog.pizzaDoughs} value={dough.id} onChange={setDoughId} />
          <DrinkCounters
            options={catalog.pizzaDrinks}
            quantities={drinkQty}
            onChange={(id, q) => setDrinkQty((cur) => ({ ...cur, [id]: Math.max(0, q) }))}
          />
          <label className="block border-t border-[#E7E5E4] pt-5">
            <span className="text-base font-semibold text-[#1C1917]">Alguma observação?</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              className="mt-2 w-full rounded-2xl border border-[#E7E5E4] px-4 py-3 text-sm outline-none focus:border-[#B91C1C]"
            />
          </label>
        </div>
      </div>

      <div className="sticky bottom-0">
        <AddBar
          quantity={quantity}
          onQuantity={(q) => setQuantity(Math.max(1, q))}
          totalCents={unitCents * quantity}
          disabled={loading}
          onAdd={add}
          message={message}
        />
      </div>
    </>
  );
}
