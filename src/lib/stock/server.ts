import { prisma } from "@/lib/db";
import { tenantHasFeature } from "@/lib/billing/features";
import {
  computeConsumption,
  isBelowMin,
  parseAddons,
  suggestedReorder,
  type OptionKind,
  type RecipeBook,
  type RecipeLine,
} from "@/lib/stock/consumption";

// Estoque de insumos no servidor: baixa por venda, estorno, movimentos e alerta de minimo.
// "location" = id da loja ou CENTRAL.

export const CENTRAL = "central";

export const OPEN_SUPPLY_STATUSES = ["aberto", "separando", "enviado"];

// Grupos de opcoes que entram na ficha tecnica (mesmos slugs do catalogo de opcoes).
const OPTION_GROUP_KINDS: Record<string, OptionKind> = {
  "pizza-tamanho": "size",
  "batata-tamanho": "size",
  "pizza-borda": "border",
  "pizza-massa": "dough",
  "pizza-bebidas": "drink",
  "batata-recheio": "filling",
};

export function optionGroupKind(slug: string): OptionKind | null {
  return OPTION_GROUP_KINDS[slug] ?? null;
}

export const RECIPE_GROUP_SLUGS = Object.keys(OPTION_GROUP_KINDS);

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

/** Fichas tecnicas da rede (produtos e opcoes). */
export async function loadRecipeBook(tenantId: string): Promise<RecipeBook> {
  const [lines, groups] = await Promise.all([
    prisma.recipeItem.findMany({
      where: { tenantId, ingredient: { active: true } },
      select: {
        ingredientId: true,
        productId: true,
        optionItemId: true,
        quantity: true,
        ingredient: { select: { unit: true } },
      },
    }),
    prisma.optionGroup.findMany({
      where: { tenantId, slug: { in: RECIPE_GROUP_SLUGS } },
      select: {
        slug: true,
        items: { select: { id: true, name: true, stockFactor: true } },
      },
    }),
  ]);

  const products = new Map<string, RecipeLine[]>();
  const byOption = new Map<string, RecipeLine[]>();

  for (const line of lines) {
    const entry = {
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      fixed: line.ingredient.unit === "un",
    };
    if (line.productId) {
      products.set(line.productId, [...(products.get(line.productId) || []), entry]);
    } else if (line.optionItemId) {
      byOption.set(line.optionItemId, [...(byOption.get(line.optionItemId) || []), entry]);
    }
  }

  const options: RecipeBook["options"] = [];
  for (const group of groups) {
    const kind = optionGroupKind(group.slug);
    if (!kind) continue;
    for (const item of group.items) {
      options.push({
        id: item.id,
        name: item.name,
        kind,
        stockFactor: item.stockFactor,
        recipe: byOption.get(item.id) || [],
      });
    }
  }

  return { products, options };
}

/** Soma (ou subtrai) um insumo num local e grava o movimento. */
export async function moveStock(input: {
  tenantId: string;
  ingredientId: string;
  location: string;
  delta: number;
  type: string;
  note?: string | null;
  userId?: string | null;
  orderId?: string | null;
  supplyRequestId?: string | null;
}) {
  const delta = round3(input.delta);
  if (!delta) return;

  await prisma.$transaction([
    prisma.stockLevel.upsert({
      where: { ingredientId_location: { ingredientId: input.ingredientId, location: input.location } },
      create: {
        tenantId: input.tenantId,
        ingredientId: input.ingredientId,
        location: input.location,
        quantity: delta,
      },
      update: { quantity: { increment: delta } },
    }),
    prisma.stockMovement.create({
      data: {
        tenantId: input.tenantId,
        ingredientId: input.ingredientId,
        location: input.location,
        type: input.type,
        quantity: delta,
        note: input.note ?? null,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        supplyRequestId: input.supplyRequestId ?? null,
      },
    }),
  ]);
}

/**
 * Baixa dos insumos quando o pedido entra em preparo.
 * Roda uma vez por pedido (se ja tem movimento de venda, nao repete).
 */
export async function applyOrderConsumption(orderId: string) {
  const already = await prisma.stockMovement.findFirst({
    where: { orderId, type: "venda" },
    select: { id: true },
  });
  if (already) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderCode: true,
      tenantId: true,
      storeId: true,
      items: {
        select: {
          productId: true,
          flavorIds: true,
          quantity: true,
          size: true,
          crust: true,
          addons_json: true,
        },
      },
    },
  });
  if (!order) return;
  // Estoque vendido como adicional: sem contratar, nao da baixa.
  if (!(await tenantHasFeature(order.tenantId, "estoque"))) return;

  const book = await loadRecipeBook(order.tenantId);
  if (book.products.size === 0 && book.options.every((o) => o.recipe.length === 0)) return;

  const consumption = computeConsumption(
    order.items.map((item) => ({
      productId: item.productId,
      flavorIds: item.flavorIds || [],
      quantity: item.quantity,
      size: item.size,
      crust: item.crust,
      addons: parseAddons(item.addons_json),
    })),
    book
  );
  if (consumption.size === 0) return;

  for (const [ingredientId, quantity] of consumption) {
    await moveStock({
      tenantId: order.tenantId,
      ingredientId,
      location: order.storeId,
      delta: -quantity,
      type: "venda",
      orderId: order.id,
      note: `Pedido ${order.orderCode}`,
    });
  }

  await checkLowStock(order.tenantId, order.storeId, Array.from(consumption.keys()));
}

/** Pedido cancelado depois da baixa: devolve os insumos (uma vez so). */
export async function reverseOrderConsumption(orderId: string) {
  const movements = await prisma.stockMovement.findMany({
    where: { orderId, type: { in: ["venda", "estorno"] } },
    select: { tenantId: true, ingredientId: true, location: true, type: true, quantity: true, note: true },
  });
  if (movements.some((m) => m.type === "estorno")) return;

  for (const sale of movements.filter((m) => m.type === "venda")) {
    await moveStock({
      tenantId: sale.tenantId,
      ingredientId: sale.ingredientId,
      location: sale.location,
      delta: -sale.quantity,
      type: "estorno",
      orderId,
      note: `${sale.note || "Pedido"} cancelado`,
    });
  }
}

/** Minimo que vale para o insumo neste local. */
export function effectiveMin(
  location: string,
  level: { minQuantity: number | null } | null | undefined,
  ingredient: { minStore: number | null }
) {
  if (level && typeof level.minQuantity === "number") return level.minQuantity;
  return location === CENTRAL ? null : ingredient.minStore;
}

/**
 * Insumo da loja passou do minimo: entra num pedido de abastecimento para a central.
 * Nao repete enquanto ja houver pedido em andamento com esse insumo.
 */
export async function checkLowStock(tenantId: string, storeId: string, ingredientIds: string[]) {
  if (ingredientIds.length === 0 || storeId === CENTRAL) return;

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds }, tenantId, active: true },
    select: {
      id: true,
      minStore: true,
      reorderQuantity: true,
      stockLevels: { where: { location: storeId }, select: { quantity: true, minQuantity: true } },
    },
  });

  for (const ingredient of ingredients) {
    const level = ingredient.stockLevels[0];
    const quantity = level?.quantity ?? 0;
    const min = effectiveMin(storeId, level, ingredient);
    if (!isBelowMin(quantity, min)) continue;

    const pending = await prisma.supplyRequestItem.findFirst({
      where: {
        ingredientId: ingredient.id,
        request: { storeId, status: { in: OPEN_SUPPLY_STATUSES } },
      },
      select: { id: true },
    });
    if (pending) continue;

    const suggested = round3(suggestedReorder(quantity, min as number, ingredient.reorderQuantity));

    try {
      const open = await prisma.supplyRequest.findFirst({
        where: { tenantId, storeId, status: "aberto", origin: "alerta" },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (open) {
        await prisma.supplyRequestItem.create({
          data: { requestId: open.id, ingredientId: ingredient.id, quantityRequested: suggested },
        });
      } else {
        await prisma.supplyRequest.create({
          data: {
            tenantId,
            storeId,
            status: "aberto",
            origin: "alerta",
            items: { create: { ingredientId: ingredient.id, quantityRequested: suggested } },
          },
        });
      }
    } catch (error) {
      // Dois pedidos ao mesmo tempo podem tentar incluir o mesmo insumo: um basta.
      console.warn("[stock][checkLowStock]", error);
    }
  }
}

/** Nunca deixa o estoque derrubar o KDS: erros so vao para o log. */
export async function safeStockHook(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    console.error(`[stock][${label}]`, error);
  }
}
