import { randomInt } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import {
  pizzaBorderOptions,
  pizzaDoughOptions,
  pizzaExtraDrinkOptions,
  pizzaSizeOptions,
} from "@/lib/product-customizations";
import { OrderRepository } from "@/lib/repositories/order.repository";
import { prisma } from "@/lib/db";
import { validateCreateOrder } from "@/lib/validators/order.validator";
import type {
  CreateOrderInput,
  CreateOrderItemInput,
  CreateOrderResult,
} from "@/types/order";

type ProductPricingContext = {
  category?: string | null;
  customizationType?: string | null;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(value: string, terms: string[]) {
  const normalized = normalizeText(value);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function getPizzaSizeDeltaCents(item: CreateOrderItemInput) {
  const size = String(item.size || "");
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const text = [size, ...addons].join(" ");

  if (includesAny(text, ["25cm", "pequena"])) return -1000;
  if (includesAny(text, ["40cm", "familia", "família"])) return 2000;
  return 0;
}

function getPizzaCrustDeltaCents(item: CreateOrderItemInput) {
  const crust = String(item.crust || "");
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const text = [crust, ...addons.filter((addon) => normalizeText(addon).includes("borda"))].join(" ");

  if (includesAny(text, ["catupiry"])) return 1590;
  if (includesAny(text, ["cream cheese"])) return 1590;
  if (includesAny(text, ["mucarela", "muçarela"])) return 1790;
  if (includesAny(text, ["calabresa c", "calabresa com"])) return 1790;
  if (includesAny(text, ["chocolate ao leite"])) return 1090;
  if (includesAny(text, ["creme de avela", "creme de avelã"])) return 1390;

  return 0;
}

function getPizzaDoughDeltaCents(item: CreateOrderItemInput) {
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const doughText = addons
    .filter((addon) => normalizeText(addon).includes("massa"))
    .join(" ");

  if (includesAny(doughText, ["integral"])) return 400;

  return 0;
}

const pizzaExtraDrinkPrices: Record<string, number> = {
  "guarana antarctica - 1,5l": 1290,
  "guarana antarctica - 2l": 1490,
  "pepsi - 1,5l": 1290,
  "pepsi - 2l": 1490,
};

function getPizzaExtraDrinksCents(item: CreateOrderItemInput) {
  const addons = Array.isArray(item.addons) ? item.addons : [];

  return addons.reduce((total, addon) => {
    const normalized = normalizeText(addon);
    const quantityMatch = normalized.match(/^(\d+)\s*x\s+(.+)$/);

    if (!quantityMatch) return total;

    const quantity = Math.max(0, Number(quantityMatch[1] || 0));
    const label = quantityMatch[2]
      .replace(/\s+/g, " ")
      .trim();

    const price = pizzaExtraDrinkPrices[label] || 0;

    return total + quantity * price;
  }, 0);
}

function getBatataSizeDeltaCents(item: CreateOrderItemInput) {
  const size = String(item.size || "");
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const text = [size, ...addons].join(" ");

  if (includesAny(text, ["media", "média"])) return 500;
  if (includesAny(text, ["grande"])) return 1000;

  return 0;
}

function getBatataFillingDeltaCents(item: CreateOrderItemInput) {
  const crust = String(item.crust || "");
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const text = [crust, ...addons.filter((addon) => normalizeText(addon).includes("recheio"))].join(" ");

  if (includesAny(text, ["cheddar"])) return 500;
  if (includesAny(text, ["catupiry"])) return 500;
  if (includesAny(text, ["bacon"])) return 700;
  if (includesAny(text, ["calabresa"])) return 700;
  if (includesAny(text, ["frango cremoso"])) return 800;

  return 0;
}

function getCustomizationPriceDeltaCents(
  item: CreateOrderItemInput,
  context: ProductPricingContext
) {
  const category = normalizeText(String(context.category || ""));
  const customizationType = normalizeText(String(context.customizationType || "auto"));
  const name = normalizeText(String(item.name || ""));

  const isDrink =
    customizationType === "bebida" ||
    category.includes("bebida") ||
    includesAny(name, ["coca", "guarana", "guaraná", "fanta", "sprite", "pepsi", "agua", "água", "suco"]);

  const isBatata =
    !isDrink &&
    (
      customizationType === "batata" ||
      category.includes("acompanhamento") ||
      category.includes("porcao") ||
      category.includes("porção") ||
      name.includes("batata")
    );

  const isPizza =
    !isDrink &&
    !isBatata &&
    (
      customizationType === "pizza" ||
      category.includes("pizza")
    );

  if (isPizza) {
    return Math.max(
      0,
      getPizzaSizeDeltaCents(item) +
        getPizzaCrustDeltaCents(item) +
        getPizzaDoughDeltaCents(item) +
        getPizzaExtraDrinksCents(item)
    );
  }

  if (isBatata) {
    return Math.max(
      0,
      getBatataSizeDeltaCents(item) + getBatataFillingDeltaCents(item)
    );
  }

  return 0;
}

const HALF_HALF_PREFIX = "half-half-";
const HALF_HALF_NAME = "Pizza Meio a Meio 40cm";

function findExactOption<T extends { name: string }>(
  options: T[],
  value: string
): T | undefined {
  const wanted = normalizeText(value);
  return options.find((option) => normalizeText(option.name) === wanted);
}

async function loadHalfHalfFlavor(
  flavorId: string,
  storeId: string,
  qty: number
): Promise<{ name: string; priceCents: number }> {
  const productStore = await prisma.productStore.findUnique({
    where: {
      productId_storeId: {
        productId: flavorId,
        storeId,
      },
    },
    select: {
      available: true,
      stock: true,
      price_cents: true,
      product: {
        select: {
          name: true,
          price_cents: true,
          available: true,
          category: true,
        },
      },
    },
  });

  if (!productStore) {
    throw new AppError("Sabor indisponível ou inválido para esta loja.", 400);
  }

  const name = productStore.product.name || "Sabor";

  if (!productStore.available || !productStore.product.available) {
    throw new AppError(`Sabor indisponível para esta loja: ${name}.`, 400);
  }

  if (!normalizeText(String(productStore.product.category || "")).includes("pizza")) {
    throw new AppError(`${name} não pode ser usado no meio a meio.`, 400);
  }

  const stock = Number(productStore.stock ?? 0);

  if (stock <= 0 || qty > stock) {
    throw new AppError(`Estoque insuficiente para ${name}.`, 400);
  }

  const priceCents =
    typeof productStore.price_cents === "number"
      ? productStore.price_cents
      : productStore.product.price_cents;

  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new AppError("Preço do sabor inválido para esta loja.", 400);
  }

  return { name, priceCents };
}

async function priceHalfHalfItem(
  item: CreateOrderItemInput,
  productId: string,
  qty: number,
  storeId: string
): Promise<CreateOrderItemInput> {
  const flavorIds = productId
    .slice(HALF_HALF_PREFIX.length)
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (flavorIds.length !== 2 || flavorIds[0] === flavorIds[1]) {
    throw new AppError("Pizza meio a meio precisa de 2 sabores diferentes.", 400);
  }

  const flavors: Array<{ name: string; priceCents: number }> = [];

  for (const flavorId of flavorIds) {
    flavors.push(await loadHalfHalfFlavor(flavorId, storeId, qty));
  }

  const addons = Array.isArray(item.addons) ? item.addons : [];

  const crustName = String(item.crust || "").trim();
  const border = crustName
    ? findExactOption(pizzaBorderOptions, crustName)
    : pizzaBorderOptions[0];

  if (!border) {
    throw new AppError("Borda inválida.", 400);
  }

  const doughAddon = addons.find((addon) =>
    normalizeText(addon).startsWith("massa:")
  );
  const doughName = doughAddon
    ? doughAddon.slice(doughAddon.indexOf(":") + 1).trim()
    : "";
  const dough = doughName
    ? findExactOption(pizzaDoughOptions, doughName)
    : pizzaDoughOptions[0];

  if (!dough) {
    throw new AppError("Massa inválida.", 400);
  }

  const drinkLines: string[] = [];
  let drinksCents = 0;

  for (const addon of addons) {
    const match = addon.trim().match(/^(\d{1,2})\s*x\s+(.+)$/i);
    if (!match) continue;

    const drinkQty = Number(match[1]);
    const drink = findExactOption(pizzaExtraDrinkOptions, match[2]);

    if (!drink || drinkQty <= 0) {
      throw new AppError("Bebida inválida no pedido.", 400);
    }

    drinksCents += drink.price_cents * drinkQty;
    drinkLines.push(`${drinkQty}x ${drink.name}`);
  }

  const size40 = pizzaSizeOptions.find((option) => option.id === "40cm");
  const sizeName = size40?.name ?? "Pizza Família - 40cm";
  const sizeDeltaCents = size40?.price_delta_cents ?? 0;

  const baseCents = Math.max(...flavors.map((flavor) => flavor.priceCents));

  return {
    ...item,
    id: productId,
    name: HALF_HALF_NAME,
    quantity: qty,
    price_cents:
      baseCents + sizeDeltaCents + border.price_cents + dough.price_cents + drinksCents,
    size: sizeName,
    crust: border.name,
    flavorIds,
    addons: [
      `Meio a meio: ${flavors.map((flavor) => flavor.name).join(" / ")}`,
      `Tamanho: ${sizeName}`,
      `Borda: ${border.name}`,
      `Massa: ${dough.name}`,
      ...drinkLines,
    ],
  };
}

async function normalizeItemsWithDBPrice(
  items: CreateOrderItemInput[],
  storeId: string
): Promise<CreateOrderItemInput[]> {
  const normalizedItems: CreateOrderItemInput[] = [];

  for (const item of items) {
    const qty =
      typeof item.quantity === "number" && item.quantity > 0
        ? item.quantity
        : 1;

    const productId = String(
      item.id ??
        (item as CreateOrderItemInput & { productId?: string | number }).productId ??
        (item as CreateOrderItemInput & { product_id?: string | number }).product_id ??
        ""
    ).trim();

    if (!productId) {
      throw new AppError("Produto inválido no pedido.", 400);
    }

    if (productId.startsWith(HALF_HALF_PREFIX)) {
      normalizedItems.push(
        await priceHalfHalfItem(item, productId, qty, storeId)
      );
      continue;
    }

    const productStore = await prisma.productStore.findUnique({
      where: {
        productId_storeId: {
          productId,
          storeId,
        },
      },
      select: {
        available: true,
        stock: true,
        price_cents: true,
        product: {
          select: {
            name: true,
            price_cents: true,
            available: true,
            category: true,
            customizationType: true,
          },
        },
      },
    });

    if (productStore) {
      const productName = productStore.product.name || item.name || "Produto";

      if (!productStore.available || !productStore.product.available) {
        throw new AppError(`Produto indisponível para esta loja: ${productName}.`, 400);
      }

      const stock = Number(productStore.stock ?? 0);

      if (stock <= 0) {
        throw new AppError(`Produto sem estoque: ${productName}.`, 400);
      }

      if (qty > stock) {
        throw new AppError(
          `Estoque insuficiente para ${productName}. Disponível: ${stock}.`,
          400
        );
      }

      const basePriceCents =
        typeof productStore.price_cents === "number"
          ? productStore.price_cents
          : productStore.product.price_cents;

      if (!Number.isFinite(basePriceCents) || basePriceCents <= 0) {
        throw new AppError("Preço do produto inválido para esta loja.", 400);
      }

      const customizationDeltaCents = getCustomizationPriceDeltaCents(item, {
        category: productStore.product.category,
        customizationType: productStore.product.customizationType,
      });

      const priceCents = Math.max(0, basePriceCents + customizationDeltaCents);

      normalizedItems.push({
        ...item,
        name: productName,
        quantity: qty,
        price_cents: priceCents,
      });

      continue;
    }

    const legacyProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId,
        available: true,
      },
      select: {
        name: true,
        price_cents: true,
        category: true,
        customizationType: true,
      },
    });

    if (!legacyProduct) {
      throw new AppError("Produto indisponível ou inválido para esta loja.", 400);
    }

    const customizationDeltaCents = getCustomizationPriceDeltaCents(item, {
      category: legacyProduct.category,
      customizationType: legacyProduct.customizationType,
    });

    normalizedItems.push({
      ...item,
      name: legacyProduct.name || item.name,
      quantity: qty,
      price_cents: legacyProduct.price_cents + customizationDeltaCents,
    });
  }

  return normalizedItems;
}

function getSubtotalCents(items: CreateOrderItemInput[]): number {
  return items.reduce((total, item) => {
    return total + Number(item.price_cents || 0) * Number(item.quantity || 0);
  }, 0);
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const onlyDigits = phone.replace(/\D/g, "");
  return onlyDigits || undefined;
}

const ORDER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeOrderCode(): string {
  let part = "";
  for (let i = 0; i < 8; i += 1) {
    part += ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return `VZ-${part.slice(0, 4)}-${part.slice(4)}`;
}

async function generateUniqueOrderCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const orderCode = makeOrderCode();

    const existing = await prisma.order.findUnique({
      where: {
        orderCode,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return orderCode;
    }
  }

  return `VZ-${Date.now()}`;
}

function normalizeStoreId(value?: string | number | null): string | undefined {
  if (value === null || typeof value === "undefined") return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class OrderService {
  static async create(rawInput: unknown): Promise<CreateOrderResult> {
    const input = validateCreateOrder(rawInput) as CreateOrderInput;

    if (!input.items?.length) {
      throw new AppError("Pedido sem itens.", 400);
    }

    const normalizedStoreId = normalizeStoreId(input.storeId ?? input.store_id);

    if (!normalizedStoreId) {
      throw new AppError("Loja do pedido é obrigatória.", 400);
    }

    const normalizedItems = await normalizeItemsWithDBPrice(
      input.items,
      normalizedStoreId
    );

    const subtotal_cents = getSubtotalCents(normalizedItems);

    const freight_cents = subtotal_cents > 0 ? 500 : 0;

    const total_cents = subtotal_cents + freight_cents;

    if (subtotal_cents <= 0 || total_cents <= 0) {
      throw new AppError("Total do pedido inválido.", 400);
    }

    return OrderRepository.create({
      ...input,
      items: normalizedItems,
      storeId: normalizedStoreId,
      store_id: normalizedStoreId,
      subtotal_cents,
      freight_cents,
      total_cents,
      order_code: await generateUniqueOrderCode(),
      status: "novo",
      customer_name_normalized: input.customer_name ?? input.customerName,
      customer_phone_normalized:
        input.customer_phone ?? normalizePhone(input.phone),
    });
  }
}
