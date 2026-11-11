import { randomInt } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import {
  defaultCatalogOption,
  loadOptionCatalog,
  type CatalogOption,
  type OptionCatalog,
} from "@/lib/options-catalog";
import { OrderRepository } from "@/lib/repositories/order.repository";
import { prisma } from "@/lib/db";
import { validateCreateOrder } from "@/lib/validators/order.validator";
import { loadStoreSettings } from "@/lib/store/settings";
import {
  computeDeliveryFeeCents,
  enabledPaymentMethods,
  getOpenStatus,
} from "@/lib/store/settings-shared";
import { formatMoneyFromCents } from "@/lib/utils/formatters";
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

const NO_OPTION: CatalogOption = { id: "", slug: "", name: "", price_cents: 0 };

// Escolhe a opcao pelo nome EXATO. Sem escolha, usa a padrao (preco zero).
function pickOption(
  options: CatalogOption[],
  value: string,
  errorMessage: string
): CatalogOption {
  const wanted = value.trim();

  if (wanted) {
    const match = findExactOption(options, wanted);

    if (!match) {
      throw new AppError(errorMessage, 400);
    }

    return match;
  }

  return defaultCatalogOption(options) ?? NO_OPTION;
}

function getAddonValue(addons: string[], label: string): string {
  const wanted = `${normalizeText(label)}:`;
  const found = addons.find((addon) =>
    normalizeText(addon).startsWith(wanted)
  );

  return found ? found.slice(found.indexOf(":") + 1).trim() : "";
}

function getPizzaExtraDrinksCents(
  addons: string[],
  catalog: OptionCatalog
): number {
  let total = 0;

  for (const addon of addons) {
    const match = addon.trim().match(/^(\d{1,2})\s*x\s+(.+)$/i);

    if (!match) continue;

    const quantity = Number(match[1]);
    const drink = findExactOption(catalog.pizzaDrinks, match[2]);

    if (!drink || quantity <= 0) {
      throw new AppError("Bebida inválida no pedido.", 400);
    }

    total += drink.price_cents * quantity;
  }

  return total;
}

function getCustomizationPriceDeltaCents(
  item: CreateOrderItemInput,
  context: ProductPricingContext,
  catalog: OptionCatalog
) {
  const category = normalizeText(String(context.category || ""));
  const customizationType = normalizeText(String(context.customizationType || "auto"));
  const name = normalizeText(String(item.name || ""));
  const addons = Array.isArray(item.addons) ? item.addons : [];

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
    const size = pickOption(
      catalog.pizzaSizes,
      getAddonValue(addons, "tamanho") || String(item.size || ""),
      "Tamanho inválido."
    );
    const border = pickOption(
      catalog.pizzaBorders,
      getAddonValue(addons, "borda") || String(item.crust || ""),
      "Borda inválida."
    );
    const dough = pickOption(
      catalog.pizzaDoughs,
      getAddonValue(addons, "massa"),
      "Massa inválida."
    );

    // Pode ser negativo (pizza pequena): o piso de zero e aplicado no preco final.
    return (
      size.price_cents +
      border.price_cents +
      dough.price_cents +
      getPizzaExtraDrinksCents(addons, catalog)
    );
  }

  if (isBatata) {
    const size = pickOption(
      catalog.potatoSizes,
      getAddonValue(addons, "tamanho da batata") || String(item.size || ""),
      "Tamanho da batata inválido."
    );
    const filling = pickOption(
      catalog.potatoFillings,
      getAddonValue(addons, "recheio") || String(item.crust || ""),
      "Recheio inválido."
    );

    return size.price_cents + filling.price_cents;
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
  storeId: string,
  catalog: OptionCatalog
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

  const border = pickOption(
    catalog.pizzaBorders,
    String(item.crust || ""),
    "Borda inválida."
  );

  const dough = pickOption(
    catalog.pizzaDoughs,
    getAddonValue(addons, "massa"),
    "Massa inválida."
  );

  const drinkLines: string[] = [];
  let drinksCents = 0;

  for (const addon of addons) {
    const match = addon.trim().match(/^(\d{1,2})\s*x\s+(.+)$/i);
    if (!match) continue;

    const drinkQty = Number(match[1]);
    const drink = findExactOption(catalog.pizzaDrinks, match[2]);

    if (!drink || drinkQty <= 0) {
      throw new AppError("Bebida inválida no pedido.", 400);
    }

    drinksCents += drink.price_cents * drinkQty;
    drinkLines.push(`${drinkQty}x ${drink.name}`);
  }

  const size40 = catalog.pizzaSizes.find(
    (option) => option.slug === "tamanho-40cm"
  );

  if (!size40) {
    throw new AppError("Tamanho família indisponível para esta loja.", 400);
  }

  const sizeName = size40.name;
  const sizeDeltaCents = size40.price_cents;

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
  const catalog = await loadOptionCatalog(storeId);

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
        await priceHalfHalfItem(item, productId, qty, storeId, catalog)
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

      const customizationDeltaCents = getCustomizationPriceDeltaCents(
        item,
        {
          category: productStore.product.category,
          customizationType: productStore.product.customizationType,
        },
        catalog
      );

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

    const customizationDeltaCents = getCustomizationPriceDeltaCents(
      item,
      {
        category: legacyProduct.category,
        customizationType: legacyProduct.customizationType,
      },
      catalog
    );

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

    // Regras da loja vem do banco (store_settings), nunca do navegador.
    const settings = await loadStoreSettings(normalizedStoreId);
    const openStatus = getOpenStatus(settings);

    if (!openStatus.open) {
      throw new AppError(openStatus.message, 409);
    }

    const paymentMethod = input.payment_method ?? input.paymentMethod ?? "pix";
    const allowedPayments = enabledPaymentMethods(settings).map((m) => m.key);

    if (!allowedPayments.includes(paymentMethod)) {
      throw new AppError("Forma de pagamento não aceita por esta loja.", 400);
    }

    const normalizedItems = await normalizeItemsWithDBPrice(
      input.items,
      normalizedStoreId
    );

    const subtotal_cents = getSubtotalCents(normalizedItems);

    if (settings.minimumOrderCents > 0 && subtotal_cents < settings.minimumOrderCents) {
      throw new AppError(
        `Pedido mínimo desta loja: ${formatMoneyFromCents(settings.minimumOrderCents)}.`,
        400
      );
    }

    const freight_cents = computeDeliveryFeeCents(settings, subtotal_cents);

    const total_cents = subtotal_cents + freight_cents;

    if (subtotal_cents <= 0 || total_cents <= 0) {
      throw new AppError("Total do pedido inválido.", 400);
    }

    return OrderRepository.create({
      ...input,
      payment_method: paymentMethod,
      paymentMethod,
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
