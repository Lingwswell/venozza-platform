"use client";

import { useMemo, useState } from "react";
import { addToCart } from "@/lib/cart-storage";
import { getMobileStoreContext } from "@/lib/mobile-store-context";
import {
  defaultOption,
  pickOption,
  useOptionCatalog,
} from "@/lib/use-option-catalog";
import {
  batataUnitCents,
  buildBatataItem,
  buildPizzaItem,
  detectProductKind,
  pizzaUnitCents,
} from "@/lib/catalog/cart-items";
import type { CatalogProduct } from "@/lib/catalog/use-store-catalog";
import SiteDialog from "@/components/site/SiteDialog";
import Plate from "@/components/site/Plate";
import { AddBar, ChoiceGroup, DrinkCounters, money } from "@/components/site/OptionPickers";
import { displayFont } from "@/lib/fonts";

// Escolha de pizza (tamanho, borda, massa, bebidas) ou batata (tamanho, recheio)
// dentro do proprio site. Monta o item igual ao app; o servidor confere o preco.
export default function ProductDialog({
  product,
  onClose,
  onAdded,
}: {
  product: CatalogProduct | null;
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  return (
    <SiteDialog open={!!product} onClose={onClose} label={product?.name || "Produto"}>
      {product ? <ProductForm key={product.id} product={product} onClose={onClose} onAdded={onAdded} /> : null}
    </SiteDialog>
  );
}

function ProductForm({
  product,
  onClose,
  onAdded,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const kind = detectProductKind(product);
  const { catalog, loading, error } = useOptionCatalog();

  const [sizeId, setSizeId] = useState("");
  const [borderId, setBorderId] = useState("");
  const [doughId, setDoughId] = useState("");
  const [potatoSizeId, setPotatoSizeId] = useState("");
  const [fillingId, setFillingId] = useState("");
  const [drinkQty, setDrinkQty] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const size = pickOption(catalog.pizzaSizes, sizeId);
  const border = pickOption(catalog.pizzaBorders, borderId);
  const dough = pickOption(catalog.pizzaDoughs, doughId);
  const potatoSize = pickOption(catalog.potatoSizes, potatoSizeId);
  const filling = pickOption(catalog.potatoFillings, fillingId);

  const drinks = useMemo(
    () =>
      catalog.pizzaDrinks
        .map((d) => ({ ...d, quantity: drinkQty[d.id] || 0 }))
        .filter((d) => d.quantity > 0),
    [catalog.pizzaDrinks, drinkQty]
  );

  const unitCents =
    kind === "pizza"
      ? pizzaUnitCents({ basePriceCents: product.price_cents, size, border, dough, drinks })
      : kind === "batata"
        ? batataUnitCents({ basePriceCents: product.price_cents, potatoSize, filling })
        : product.price_cents;

  const missingSize = kind === "pizza" && !loading && catalog.pizzaSizes.length === 0;

  function add() {
    const store = getMobileStoreContext();
    const ctx = { tenantId: store.tenantId, storeId: store.storeId };
    const base = { id: product.id, name: product.name, image: product.image };

    if (kind === "pizza") {
      addToCart(buildPizzaItem({ product: base, size, border, dough, drinks, unitCents, quantity, note, store: ctx }));
    } else if (kind === "batata") {
      addToCart(buildBatataItem({ product: base, potatoSize, filling, unitCents, quantity, note, store: ctx }));
    } else {
      addToCart({
        id: product.id,
        name: product.name,
        price_cents: product.price_cents,
        quantity,
        image: product.image || "",
        note,
        tenantId: ctx.tenantId,
        storeId: ctx.storeId,
      });
    }

    onAdded(product.name);
    onClose();
  }

  return (
    <>
      <div className="px-6 pb-6 pt-8">
        <div className="flex items-center gap-5 pr-10">
          <Plate src={product.image} name={product.name} size={112} />
          <div className="min-w-0">
            <h2 className={`${displayFont.className} text-[28px] font-bold leading-tight tracking-[-0.02em]`}>
              {product.name}
            </h2>
            {product.description ? (
              <p className="mt-1 text-sm leading-relaxed text-[#6B625B]">{product.description}</p>
            ) : null}
            <p className="mt-2 font-semibold text-[#C8171E]">
              {kind === "pizza" ? `a partir de ${money(product.price_cents + (defaultOption(catalog.pizzaSizes).price_cents || 0))}` : money(product.price_cents)}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {loading && (kind === "pizza" || kind === "batata") ? (
            <p className="text-sm text-[#857A71]">Carregando opções...</p>
          ) : error ? (
            <p className="rounded-2xl bg-[#FDEDEC] px-4 py-3 text-sm text-[#A3141A]">{error}</p>
          ) : null}

          {missingSize ? (
            <p className="rounded-2xl bg-[#FDEDEC] px-4 py-3 text-sm text-[#A3141A]">
              Esta loja ainda não cadastrou tamanhos de pizza. Escolha outra loja ou fale com a loja.
            </p>
          ) : null}

          {kind === "pizza" ? (
            <>
              <ChoiceGroup title="Tamanho" name="tamanho" options={catalog.pizzaSizes} value={size.id} onChange={setSizeId} zeroLabel="Preço base" />
              <ChoiceGroup title="Borda" name="borda" options={catalog.pizzaBorders} value={border.id} onChange={setBorderId} />
              <ChoiceGroup title="Massa" name="massa" options={catalog.pizzaDoughs} value={dough.id} onChange={setDoughId} />
              <DrinkCounters
                options={catalog.pizzaDrinks}
                quantities={drinkQty}
                onChange={(id, q) => setDrinkQty((cur) => ({ ...cur, [id]: Math.max(0, q) }))}
              />
            </>
          ) : null}

          {kind === "batata" ? (
            <>
              <ChoiceGroup title="Tamanho" name="tamanho-batata" options={catalog.potatoSizes} value={potatoSize.id} onChange={setPotatoSizeId} />
              <ChoiceGroup title="Recheio" name="recheio" options={catalog.potatoFillings} value={filling.id} onChange={setFillingId} />
            </>
          ) : null}

          <label className="block border-t border-[#ECE6DF] pt-5">
            <span className="text-base font-semibold text-[#1F1A17]">Alguma observação?</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Ex.: sem cebola, bem assada"
              className="mt-2 w-full rounded-2xl border border-[#ECE6DF] px-4 py-3 text-sm outline-none focus:border-[#C8171E]"
            />
          </label>
        </div>
      </div>

      <div className="sticky bottom-0">
        <AddBar
          quantity={quantity}
          onQuantity={(q) => setQuantity(Math.max(1, q))}
          totalCents={unitCents * quantity}
          disabled={missingSize || (loading && (kind === "pizza" || kind === "batata"))}
          onAdd={add}
        />
      </div>
    </>
  );
}
