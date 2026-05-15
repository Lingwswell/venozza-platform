"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart-storage";
import { formatMoneyFromCents } from "@/lib/utils/formatters";
import {
  pizzaSizeOptions as sizeOptions,
  pizzaBorderOptions as borderOptions,
  pizzaDoughOptions as doughOptions,
  pizzaExtraDrinkOptions as drinkOptions,
  potatoSizeOptions,
  potatoFillingOptions,
  type CustomizationOptionItem as OptionItem,
  type PizzaSizeOption,
} from "@/lib/product-customizations";
import {
  getMobileStoreContext,
  getMobileStoreHeaders,
} from "@/lib/mobile-store-context";

type Product = {
  id: string | number;
  name: string;
  description?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  price?: number;
  price_cents?: number;
  priceCents?: number;
  category?: string | null;
  customizationType?: string | null;
  active?: boolean;
  available?: boolean;
  storeId?: string | null;
};

function getProductPriceCents(product: Product): number {
  if (typeof product.price_cents === "number") return product.price_cents;
  if (typeof product.priceCents === "number") return product.priceCents;
  if (typeof product.price === "number") return Math.round(product.price * 100);
  return 0;
}

function getProductImage(product: Product) {
  return product.imageUrl || product.image || "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getBeverageGroupName(product: Product) {
  const name = String(product.name || "").trim();
  const normalized = normalizeText(name);

  const knownBrands = [
    { match: "coca-cola zero", label: "Coca-Cola Zero" },
    { match: "coca cola zero", label: "Coca-Cola Zero" },
    { match: "coca-cola", label: "Coca-Cola" },
    { match: "coca cola", label: "Coca-Cola" },
    { match: "guarana antarctica", label: "Guaraná Antarctica" },
    { match: "guarana", label: "Guaraná" },
    { match: "fanta", label: "Fanta" },
    { match: "sprite", label: "Sprite" },
    { match: "pepsi", label: "Pepsi" },
    { match: "agua", label: "Água" },
    { match: "suco", label: "Suco" },
  ];

  const brand = knownBrands.find((item) => normalized.includes(item.match));

  if (brand) return brand.label;

  return name
    .replace(/\b(lata|mini|garrafa|pet|retornavel|retornável|caixa)\b/gi, "")
    .replace(/\b\d+(?:[,.]\d+)?\s*(ml|l|litros|litro)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || name;
}

function getBeverageVariantLabel(product: Product) {
  const groupName = getBeverageGroupName(product);
  const label = String(product.name || "")
    .replace(new RegExp(groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
    .replace(/\s+/g, " ")
    .trim();

  return label || "Tamanho único";
}


type BeverageVariantMeta = {
  product: Product;
  typeLabel: string;
  packageLabel: string;
  sizeLabel: string;
  sizeMl: number;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBeverageName(product: Product) {
  return normalizeText(String(product.name || ""));
}

function getBeveragePackageLabel(product: Product) {
  const normalized = normalizeBeverageName(product);

  if (normalized.includes("lata")) return "Lata";
  if (normalized.includes("vidro")) return "Vidro";

  if (
    normalized.includes("pet") ||
    normalized.includes("garrafa") ||
    normalized.includes("mini")
  ) {
    return "PET";
  }

  return "Outros";
}

function getBeverageSizeLabel(product: Product) {
  const name = String(product.name || "");

  const match = name.match(/(\d+(?:[,.]\d+)?)\s*(ml|l|litros|litro)\b/i);

  if (!match) return "Tamanho único";

  const number = match[1].replace(",", ".");
  const unit = match[2].toLowerCase();

  if (unit === "ml") return `${Number(number)}ml`;

  const liters = Number(number);

  if (!Number.isFinite(liters)) return match[0];

  return `${String(liters).replace(".", ",")}L`;
}

function getBeverageSizeMl(product: Product) {
  const label = getBeverageSizeLabel(product);
  const normalized = normalizeText(label).replace(",", ".");

  const mlMatch = normalized.match(/(\d+(?:\.\d+)?)ml/);
  if (mlMatch) return Math.round(Number(mlMatch[1]));

  const literMatch = normalized.match(/(\d+(?:\.\d+)?)l/);
  if (literMatch) return Math.round(Number(literMatch[1]) * 1000);

  return 999999;
}

function getBeverageTypeLabel(product: Product, groupName: string) {
  const name = String(product.name || "");
  const normalized = normalizeText(name);

  if (normalized.includes("zero")) return "Zero";
  if (normalized.includes("sem acucar") || normalized.includes("sem açúcar")) return "Zero Açúcar";
  if (normalized.includes("diet")) return "Diet";

  if (normalizeText(groupName).includes("fanta")) {
    if (normalized.includes("laranja")) return "Laranja";
    if (normalized.includes("uva")) return "Uva";
    if (normalized.includes("guarana") || normalized.includes("guaraná")) return "Guaraná";
  }

  if (normalizeText(groupName).includes("sprite")) {
    if (normalized.includes("lemon")) return "Lemon Fresh";
  }

  let cleaned = name
    .replace(new RegExp(escapeRegex(groupName), "i"), "")
    .replace(/\b(coca[ -]?cola|fanta|sprite|pepsi|guaran[aá](?:\s+antarctica)?)\b/gi, "")
    .replace(/\b(lata|mini|garrafa|pet|vidro|retornavel|retornável|caixa)\b/gi, "")
    .replace(/\b\d+(?:[,.]\d+)?\s*(ml|l|litros|litro)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Original";

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function packageSortValue(value: string) {
  const order: Record<string, number> = {
    Lata: 1,
    PET: 2,
    Vidro: 3,
    Outros: 9,
  };

  return order[value] || 99;
}

function uniqueOrdered(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isBeverage(product: Product | null) {
  if (!product) return false;

  const name = normalizeText(String(product.name || ""));
  const category = normalizeText(String(product.category || ""));
  const customizationType = normalizeText(String(product.customizationType || "auto"));

  return (
    category.includes("bebida") ||
    customizationType === "bebida" ||
    name.includes("coca") ||
    name.includes("guarana") ||
    name.includes("fanta") ||
    name.includes("sprite") ||
    name.includes("pepsi") ||
    name.includes("refrigerante") ||
    name.includes("agua") ||
    name.includes("suco")
  );
}

function getProductsFromResponse(data: any): Product[] {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function OptionRow({
  option,
  selected,
  onClick,
}: {
  option: OptionItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
        selected ? "border-[#ff1010] bg-[#fff1f1]" : "border-[#eadfda] bg-white",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className="text-sm font-black text-[#171717]">{option.name}</p>
        {option.description ? (
          <p className="mt-1 text-xs leading-relaxed text-[#777]">{option.description}</p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-xs font-bold text-[#777]">
          {option.price_cents > 0 ? `+ ${formatMoneyFromCents(option.price_cents)}` : "Grátis"}
        </p>
        <span
          className={[
            "mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
            selected
              ? "border-[#ff1010] bg-[#ff1010] text-white"
              : "border-[#ddd] bg-white text-transparent",
          ].join(" ")}
        >
          ✓
        </span>
      </div>
    </button>
  );
}

function CounterRow({
  option,
  quantity,
  onIncrement,
  onDecrement,
}: {
  option: OptionItem;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#eadfda] bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-black text-[#171717]">{option.name}</p>
        <p className="mt-1 text-xs font-bold text-[#ff1010]">
          + {formatMoneyFromCents(option.price_cents)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDecrement}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfda] bg-white text-lg font-black text-[#171717]"
        >
          -
        </button>

        <span className="min-w-5 text-center text-sm font-black">{quantity}</span>

        <button
          type="button"
          onClick={onIncrement}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff1010] text-lg font-black text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function MobileProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const productId = String(params?.id || "");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSizeId, setSelectedSizeId] = useState<PizzaSizeOption["id"]>("35cm");
  const [selectedPotatoSizeId, setSelectedPotatoSizeId] = useState("batata-pequena");
  const [selectedBorderId, setSelectedBorderId] = useState("sem-borda");
  const [selectedDoughId, setSelectedDoughId] = useState("massa-tradicional");
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});
  const [selectedBeverageVariantId, setSelectedBeverageVariantId] = useState("");
  const [selectedBeverageType, setSelectedBeverageType] = useState("");
  const [selectedBeveragePackage, setSelectedBeveragePackage] = useState("");
  const [selectedBeverageSize, setSelectedBeverageSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const product = useMemo(() => {
    return products.find((item) => String(item.id) === productId) || null;
  }, [products, productId]);

  const normalizedProductName = String(product?.name || "").toLowerCase();
  const normalizedProductCategory = String(product?.category || "").toLowerCase();
  const normalizedCustomizationType = String(product?.customizationType || "auto").toLowerCase();

  const inferredDrink =
    normalizedProductCategory.includes("bebida") ||
    normalizedProductName.includes("coca") ||
    normalizedProductName.includes("guarana") ||
    normalizedProductName.includes("guaraná") ||
    normalizedProductName.includes("pepsi") ||
    normalizedProductName.includes("fanta") ||
    normalizedProductName.includes("sprite") ||
    normalizedProductName.includes("refrigerante") ||
    normalizedProductName.includes("suco") ||
    normalizedProductName.includes("agua") ||
    normalizedProductName.includes("água");

  const inferredBatata =
    !inferredDrink &&
    (
      normalizedProductName.includes("batata") ||
      normalizedProductName.includes("batatinha") ||
      normalizedProductCategory.includes("acompanhamento") ||
      normalizedProductCategory.includes("porcao") ||
      normalizedProductCategory.includes("porção")
    );

  const inferredPizza =
    !inferredDrink &&
    normalizedProductCategory.includes("pizza") &&
    !inferredBatata;

  const isDrink =
    normalizedCustomizationType === "bebida" ||
    normalizedCustomizationType === "simples" ||
    (normalizedCustomizationType === "auto" && inferredDrink);

  const isBatata =
    !isDrink &&
    (
      normalizedCustomizationType === "batata" ||
      (normalizedCustomizationType === "auto" && inferredBatata)
    );

  const isPizza =
    !isDrink &&
    !isBatata &&
    (
      normalizedCustomizationType === "pizza" ||
      (normalizedCustomizationType === "auto" && inferredPizza)
    );

  const customizationOptions = isBatata
    ? potatoFillingOptions
    : isPizza
      ? borderOptions
      : [];

  const beverageGroupName = product && isDrink ? getBeverageGroupName(product) : "";

  const beverageVariants = useMemo(() => {
    if (!product || !isDrink) return [];

    return products
      .filter((item) => isBeverage(item))
      .filter((item) => getBeverageGroupName(item) === beverageGroupName)
      .filter((item) => item.available !== false && item.active !== false)
      .sort((a, b) => getProductPriceCents(a) - getProductPriceCents(b));
  }, [products, product, isDrink, beverageGroupName]);

  const beverageVariantMetas = useMemo<BeverageVariantMeta[]>(() => {
    if (!isDrink || !beverageGroupName) return [];

    return beverageVariants
      .map((variant) => ({
        product: variant,
        typeLabel: getBeverageTypeLabel(variant, beverageGroupName),
        packageLabel: getBeveragePackageLabel(variant),
        sizeLabel: getBeverageSizeLabel(variant),
        sizeMl: getBeverageSizeMl(variant),
      }))
      .sort((a, b) => {
        const typeCompare = a.typeLabel.localeCompare(b.typeLabel, "pt-BR");
        if (typeCompare !== 0) return typeCompare;

        const packageCompare = packageSortValue(a.packageLabel) - packageSortValue(b.packageLabel);
        if (packageCompare !== 0) return packageCompare;

        return a.sizeMl - b.sizeMl;
      });
  }, [isDrink, beverageVariants, beverageGroupName]);

  const beverageTypeOptions = useMemo(() => {
    return uniqueOrdered(beverageVariantMetas.map((item) => item.typeLabel));
  }, [beverageVariantMetas]);

  const beveragePackageOptions = useMemo(() => {
    return uniqueOrdered(
      beverageVariantMetas
        .filter((item) => !selectedBeverageType || item.typeLabel === selectedBeverageType)
        .map((item) => item.packageLabel)
    ).sort((a, b) => packageSortValue(a) - packageSortValue(b));
  }, [beverageVariantMetas, selectedBeverageType]);

  const beverageSizeOptions = useMemo(() => {
    return beverageVariantMetas
      .filter((item) => !selectedBeverageType || item.typeLabel === selectedBeverageType)
      .filter((item) => !selectedBeveragePackage || item.packageLabel === selectedBeveragePackage)
      .sort((a, b) => a.sizeMl - b.sizeMl);
  }, [beverageVariantMetas, selectedBeverageType, selectedBeveragePackage]);

  const selectedBeverageMeta = useMemo(() => {
    if (!isDrink) return null;

    return (
      beverageVariantMetas.find(
        (item) =>
          item.typeLabel === selectedBeverageType &&
          item.packageLabel === selectedBeveragePackage &&
          item.sizeLabel === selectedBeverageSize
      ) ||
      beverageVariantMetas.find((item) => String(item.product.id) === selectedBeverageVariantId) ||
      beverageVariantMetas.find((item) => String(item.product.id) === productId) ||
      beverageVariantMetas[0] ||
      null
    );
  }, [
    isDrink,
    beverageVariantMetas,
    selectedBeverageType,
    selectedBeveragePackage,
    selectedBeverageSize,
    selectedBeverageVariantId,
    productId,
  ]);

  const selectedBeverageVariant = isDrink
    ? selectedBeverageMeta?.product || product
    : product;

  useEffect(() => {
    if (!isDrink || beverageVariantMetas.length === 0) return;

    const nextType = beverageTypeOptions.includes(selectedBeverageType)
      ? selectedBeverageType
      : beverageTypeOptions[0] || "";

    if (nextType !== selectedBeverageType) {
      setSelectedBeverageType(nextType);
      return;
    }

    const nextPackage = beveragePackageOptions.includes(selectedBeveragePackage)
      ? selectedBeveragePackage
      : beveragePackageOptions[0] || "";

    if (nextPackage !== selectedBeveragePackage) {
      setSelectedBeveragePackage(nextPackage);
      return;
    }

    const sizeLabels = beverageSizeOptions.map((item) => item.sizeLabel);
    const nextSize = sizeLabels.includes(selectedBeverageSize)
      ? selectedBeverageSize
      : sizeLabels[0] || "";

    if (nextSize !== selectedBeverageSize) {
      setSelectedBeverageSize(nextSize);
    }
  }, [
    isDrink,
    beverageVariantMetas,
    beverageTypeOptions,
    beveragePackageOptions,
    beverageSizeOptions,
    selectedBeverageType,
    selectedBeveragePackage,
    selectedBeverageSize,
  ]);

  const selectedSize = useMemo(() => {
    return sizeOptions.find((item) => item.id === selectedSizeId) || sizeOptions[1];
  }, [selectedSizeId]);

  const selectedPotatoSize = useMemo(() => {
    return (
      potatoSizeOptions.find((item) => item.id === selectedPotatoSizeId) ||
      potatoSizeOptions[0]
    );
  }, [selectedPotatoSizeId]);

  const selectedCustomization = useMemo(() => {
    return (
      customizationOptions.find((item) => item.id === selectedBorderId) ||
      customizationOptions[0] ||
      { id: "sem-complemento", name: "Sem complemento", price_cents: 0 }
    );
  }, [customizationOptions, selectedBorderId]);

  const selectedDough = useMemo(() => {
    return doughOptions.find((item) => item.id === selectedDoughId) || doughOptions[0];
  }, [selectedDoughId]);

  const selectedDrinks = useMemo(() => {
    return drinkOptions
      .map((drink) => ({
        ...drink,
        quantity: Number(drinkQuantities[drink.id] || 0),
      }))
      .filter((drink) => drink.quantity > 0);
  }, [drinkQuantities]);

  const basePriceCents =
    isDrink && selectedBeverageVariant
      ? getProductPriceCents(selectedBeverageVariant)
      : product
        ? getProductPriceCents(product)
        : 0;

  const selectedSizeBasePriceCents = useMemo(() => {
    return Math.max(0, basePriceCents + Number(selectedSize.price_delta_cents || 0));
  }, [basePriceCents, selectedSize]);

  const unitTotalCents = useMemo(() => {
    const drinksTotal = selectedDrinks.reduce((sum, drink) => {
      return sum + drink.price_cents * drink.quantity;
    }, 0);

    const productBasePriceCents = isPizza ? selectedSizeBasePriceCents : basePriceCents;

    return Math.max(
      0,
      productBasePriceCents +
        (isBatata ? Number(selectedPotatoSize.price_cents || 0) : 0) +
        (isPizza || isBatata ? Number(selectedCustomization.price_cents || 0) : 0) +
        (isPizza ? Number(selectedDough.price_cents || 0) : 0) +
        (isPizza ? drinksTotal : 0)
    );
  }, [
    isPizza,
    isBatata,
    basePriceCents,
    selectedSizeBasePriceCents,
    selectedPotatoSize,
    selectedCustomization,
    selectedDough,
    selectedDrinks,
  ]);

  const finalTotalCents = unitTotalCents * quantity;

  useEffect(() => {
    let alive = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/products", {
          cache: "no-store",
          headers: getMobileStoreHeaders(),
        });

        const data = await res.json();

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "Erro ao carregar produto");
        }

        const list = getProductsFromResponse(data);

        if (alive) {
          setProducts(list);
          setSelectedBeverageVariantId((current) => current || productId);
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "Erro ao carregar produto");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      alive = false;
    };
  }, []);

  function updateDrinkQuantity(id: string, nextQuantity: number) {
    setDrinkQuantities((current) => ({
      ...current,
      [id]: Math.max(0, nextQuantity),
    }));
  }

  function handleAddToCart() {
    if (!product) return;

    const mobileStore = getMobileStoreContext();
    const cartProduct = isDrink && selectedBeverageVariant ? selectedBeverageVariant : product;

    const addons = [
      isPizza
        ? `Sabor: ${product.name}`
        : isDrink
          ? `Bebida: ${cartProduct.name}`
          : `Produto: ${product.name}`,
      ...(isPizza
        ? [
            `Tamanho: ${selectedSize.name}`,
            `Borda: ${selectedCustomization.name}`,
            `Massa: ${selectedDough.name}`,
            ...selectedDrinks.map((drink) => `${drink.quantity}x ${drink.name}`),
          ]
        : isBatata
          ? [
              `Tamanho da batata: ${selectedPotatoSize.name}`,
              `Recheio: ${selectedCustomization.name}`,
            ]
          : isDrink
            ? [`Marca: ${beverageGroupName || cartProduct.name}`]
            : ["Produto simples"]),
    ];

    addToCart({
      id: String(cartProduct.id),
      name: cartProduct.name,
      price_cents: unitTotalCents,
      quantity,
      image: getProductImage(cartProduct),
      note,
      addons,
      crust: isPizza || isBatata ? selectedCustomization.name : undefined,
      size: isPizza ? selectedSize.name : isBatata ? selectedPotatoSize.name : undefined,
      tenantId: mobileStore.tenantId,
      storeId: mobileStore.storeId,
    });

    router.push("/m/carrinho");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f1ef] px-4 py-6 text-[#171717]">
        <p className="text-sm font-bold text-[#777]">Carregando produto...</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#f7f1ef] px-4 py-6 text-[#171717]">
        <button
          onClick={() => router.back()}
          className="mb-6 rounded-full border border-[#eadfda] bg-white px-4 py-2 text-sm font-black text-[#555]"
        >
          Voltar
        </button>

        <h1 className="text-xl font-black">Produto não encontrado</h1>
        <p className="mt-2 text-sm text-[#777]">
          {error || "Esse produto não está disponível no momento."}
        </p>
      </main>
    );
  }

  const displayProductName = isDrink && beverageGroupName ? beverageGroupName : product.name;
  const displayProductDescription =
    isDrink && beverageVariants.length > 1
      ? `Escolha uma das ${beverageVariants.length} opções disponíveis de ${beverageGroupName}.`
      : product.description || "Selecione as opções e adicione ao carrinho.";

  const image = getProductImage(
    isDrink && selectedBeverageVariant ? selectedBeverageVariant : product
  );

  return (
    <main className="min-h-screen bg-[#f7f1ef] pb-32 text-[#171717]">
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <button
          onClick={() => router.back()}
          className="mb-4 rounded-full border border-[#eadfda] bg-white px-4 py-2 text-sm font-black text-[#555] shadow-sm"
        >
          Voltar
        </button>

        <section className="overflow-hidden rounded-[28px] border border-[#eadfda] bg-white shadow-sm">
          {image ? (
            <img src={image} alt={displayProductName} className="h-56 w-full object-cover" />
          ) : (
            <div className="flex h-56 w-full items-center justify-center bg-[#fff4f0] text-sm font-bold text-[#999]">
              Sem imagem
            </div>
          )}

          <div className="p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff1010]">
              {isDrink ? "Bebida" : product.category || "Pizza"}
            </p>

            <h1 className="mt-2 text-2xl font-black text-[#171717]">{displayProductName}</h1>

            <p className="mt-2 text-sm leading-6 text-[#666]">
              {displayProductDescription}
            </p>

            <div className="mt-4 rounded-2xl bg-[#fff7f5] p-4">
              <p className="text-xs font-bold text-[#777]">
                {isPizza
                  ? "Preço no tamanho selecionado"
                  : isBatata
                    ? "Preço da batata"
                    : isDrink
                      ? "Preço da opção selecionada"
                      : "Preço do produto"}
              </p>
              <p className="mt-1 text-2xl font-black text-[#ff1010]">
                {formatMoneyFromCents(isPizza ? selectedSizeBasePriceCents : basePriceCents)}
              </p>
              {isPizza ? (
                <p className="mt-1 text-xs font-semibold text-[#777]">
                  {selectedSize.name}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {isPizza ? (
          <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-black">Escolha o tamanho</h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">
                Para meio a meio, use o card próprio de pizza meio a meio.
              </p>
            </div>

            <div className="space-y-3">
              {sizeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedSizeId(option.id)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    selectedSizeId === option.id
                      ? "border-[#ff1010] bg-[#fff1f1]"
                      : "border-[#eadfda] bg-white",
                  ].join(" ")}
                >
                  <div>
                    <p className="text-sm font-black text-[#171717]">{option.name}</p>
                    <p className="mt-1 text-xs text-[#777]">{option.description}</p>
                  </div>

                  <div className="text-right text-xs font-black text-[#ff1010]">
                    {option.price_delta_cents > 0
                      ? `+ ${formatMoneyFromCents(option.price_delta_cents)}`
                      : option.price_delta_cents < 0
                        ? `- ${formatMoneyFromCents(Math.abs(option.price_delta_cents))}`
                        : "Base"}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {isBatata ? (
          <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-black">Tamanho da batata</h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">
                Tamanhos próprios da batata, separados dos tamanhos de pizza.
              </p>
            </div>

            <div className="space-y-3">
              {potatoSizeOptions.map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  selected={selectedPotatoSizeId === option.id}
                  onClick={() => setSelectedPotatoSizeId(option.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {isPizza ? (
          <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-black">Sabor selecionado</h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">
                Esta tela é para pizza de 1 sabor.
              </p>
            </div>

            <div className="rounded-2xl border border-[#ff1010] bg-[#fff1f1] px-4 py-3">
              <p className="text-sm font-black text-[#171717]">{product.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#777]">
                {product.description || "Produto disponível nesta loja."}
              </p>
              <p className="mt-2 text-xs font-black text-[#ff1010]">
                {formatMoneyFromCents(selectedSizeBasePriceCents)}
              </p>
            </div>
          </section>
        ) : null}

        {isPizza || isBatata ? (
          <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-black">
                {isBatata ? "Recheios da batata" : "Bordas"}
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">Opcional</p>
            </div>

            <div className="space-y-3">
              {customizationOptions.map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  selected={selectedBorderId === option.id}
                  onClick={() => setSelectedBorderId(option.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {isPizza ? (
          <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-black">Massa da pizza</h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">Opcional</p>
            </div>

            <div className="space-y-3">
              {doughOptions.map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  selected={selectedDoughId === option.id}
                  onClick={() => setSelectedDoughId(option.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {isPizza ? (
          <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-black">Bebidas</h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">Opcional</p>
            </div>

            <div className="space-y-3">
              {drinkOptions.map((option) => (
                <CounterRow
                  key={option.id}
                  option={option}
                  quantity={Number(drinkQuantities[option.id] || 0)}
                  onIncrement={() =>
                    updateDrinkQuantity(option.id, Number(drinkQuantities[option.id] || 0) + 1)
                  }
                  onDecrement={() =>
                    updateDrinkQuantity(option.id, Number(drinkQuantities[option.id] || 0) - 1)
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {isDrink && beverageVariantMetas.length > 0 ? (
          <section className="mt-5 space-y-4 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-black">Monte sua bebida</h2>
              <p className="mt-1 text-xs font-semibold text-[#777]">
                Escolha tipo, embalagem e tamanho. O carrinho recebe o produto real selecionado.
              </p>
            </div>

            {beverageTypeOptions.length > 1 ? (
              <div>
                <h3 className="mb-2 text-sm font-black text-[#171717]">Tipo</h3>
                <div className="grid grid-cols-2 gap-2">
                  {beverageTypeOptions.map((typeLabel) => {
                    const selected = selectedBeverageType === typeLabel;

                    return (
                      <button
                        key={typeLabel}
                        type="button"
                        onClick={() => {
                          setSelectedBeverageType(typeLabel);
                          setSelectedBeveragePackage("");
                          setSelectedBeverageSize("");
                          setSelectedBeverageVariantId("");
                        }}
                        className={[
                          "rounded-2xl border px-3 py-3 text-left text-sm font-black transition",
                          selected
                            ? "border-[#ff1010] bg-[#fff1f1] text-[#ff1010]"
                            : "border-[#eadfda] bg-white text-[#171717]",
                        ].join(" ")}
                      >
                        {typeLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {beveragePackageOptions.length > 1 ? (
              <div>
                <h3 className="mb-2 text-sm font-black text-[#171717]">Embalagem</h3>
                <div className="grid grid-cols-3 gap-2">
                  {beveragePackageOptions.map((packageLabel) => {
                    const selected = selectedBeveragePackage === packageLabel;

                    return (
                      <button
                        key={packageLabel}
                        type="button"
                        onClick={() => {
                          setSelectedBeveragePackage(packageLabel);
                          setSelectedBeverageSize("");
                          setSelectedBeverageVariantId("");
                        }}
                        className={[
                          "rounded-2xl border px-3 py-3 text-center text-sm font-black transition",
                          selected
                            ? "border-[#ff1010] bg-[#fff1f1] text-[#ff1010]"
                            : "border-[#eadfda] bg-white text-[#171717]",
                        ].join(" ")}
                      >
                        {packageLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-black text-[#171717]">Tamanho</h3>
              <div className="space-y-3">
                {beverageSizeOptions.map((meta) => {
                  const selected =
                    String(selectedBeverageVariant?.id) === String(meta.product.id);

                  return (
                    <button
                      key={String(meta.product.id)}
                      type="button"
                      onClick={() => {
                        setSelectedBeverageType(meta.typeLabel);
                        setSelectedBeveragePackage(meta.packageLabel);
                        setSelectedBeverageSize(meta.sizeLabel);
                        setSelectedBeverageVariantId(String(meta.product.id));
                      }}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
                        selected ? "border-[#ff1010] bg-[#fff1f1]" : "border-[#eadfda] bg-white",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#171717]">
                          {meta.sizeLabel}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#777]">
                          {meta.product.name}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-[#ff1010]">
                          {formatMoneyFromCents(getProductPriceCents(meta.product))}
                        </p>
                        <span
                          className={[
                            "mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                            selected
                              ? "border-[#ff1010] bg-[#ff1010] text-white"
                              : "border-[#ddd] bg-white text-transparent",
                          ].join(" ")}
                        >
                          ✓
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-[28px] border border-[#eadfda] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Alguma observação?</h2>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              isPizza
                ? "Ex: sem cebola, pouco molho, cortar em mais fatias..."
                : isBatata
                  ? "Ex: sem bacon, cheddar separado, caprichar no molho..."
                  : "Ex: entregar gelado, sem canudo..."
            }
            className="mt-3 min-h-28 w-full rounded-2xl border border-[#eadfda] px-4 py-3 text-sm outline-none"
          />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#eadfda] bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <div className="flex items-center rounded-full border border-[#eadfda] bg-white px-2 py-1">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-black text-[#555]"
            >
              -
            </button>

            <span className="min-w-8 text-center text-sm font-black">{quantity}</span>

            <button
              type="button"
              onClick={() => setQuantity((current) => current + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-black text-[#555]"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="flex h-14 flex-1 items-center justify-center rounded-full bg-[#ff1010] px-5 text-sm font-black text-white shadow-sm"
          >
            Adicionar {formatMoneyFromCents(finalTotalCents)}
          </button>
        </div>
      </div>
    </main>
  );
}
