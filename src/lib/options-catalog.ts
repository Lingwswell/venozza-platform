import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

export type CatalogOption = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
};

export type OptionCatalog = {
  pizzaSizes: CatalogOption[];
  pizzaBorders: CatalogOption[];
  pizzaDoughs: CatalogOption[];
  pizzaDrinks: CatalogOption[];
  potatoSizes: CatalogOption[];
  potatoFillings: CatalogOption[];
};

type CatalogKey = keyof OptionCatalog;

// Grupos de opcoes (OptionGroup.slug) que alimentam cada lista do catalogo.
const GROUP_SLUGS: Record<CatalogKey, string> = {
  pizzaSizes: "pizza-tamanho",
  pizzaBorders: "pizza-borda",
  pizzaDoughs: "pizza-massa",
  pizzaDrinks: "pizza-bebidas",
  potatoSizes: "batata-tamanho",
  potatoFillings: "batata-recheio",
};

function emptyCatalog(): OptionCatalog {
  return {
    pizzaSizes: [],
    pizzaBorders: [],
    pizzaDoughs: [],
    pizzaDrinks: [],
    potatoSizes: [],
    potatoFillings: [],
  };
}

// Opcao padrao quando o cliente nao escolhe: a de preco zero (ex.: massa tradicional).
export function defaultCatalogOption(
  options: CatalogOption[]
): CatalogOption | undefined {
  return options.find((option) => option.price_cents === 0) ?? options[0];
}

// Le as opcoes da rede e da loja no banco. O preco da loja (se houver) vale mais que o da rede.
// O servidor usa esta mesma funcao para cobrar o pedido: o que aparece e o que e cobrado.
export async function loadOptionCatalog(storeId: string): Promise<OptionCatalog> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true },
  });

  if (!store) {
    throw new AppError("Loja inválida.", 400);
  }

  const catalog = emptyCatalog();

  const groups = await prisma.optionGroup.findMany({
    where: {
      tenantId: store.tenantId,
      active: true,
      slug: { in: Object.values(GROUP_SLUGS) },
    },
    select: { id: true, slug: true },
  });

  if (groups.length === 0) return catalog;

  const items = await prisma.optionItem.findMany({
    where: {
      tenantId: store.tenantId,
      active: true,
      optionGroupId: { in: groups.map((group) => group.id) },
      // Opcao da rede vale para todas as lojas; a loja so some com ela se a
      // desligar explicitamente (available = false). Loja nova ja nasce completa.
      storeOptionAvailabilities: {
        none: { storeId, available: false },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      price_cents: true,
      optionGroupId: true,
      storeOptionAvailabilities: {
        where: { storeId },
        select: { price_cents: true },
      },
    },
  });

  const slugByGroupId = new Map(groups.map((group) => [group.id, group.slug]));
  const keys = Object.keys(GROUP_SLUGS) as CatalogKey[];

  for (const item of items) {
    const groupSlug = slugByGroupId.get(item.optionGroupId);
    const key = keys.find((candidate) => GROUP_SLUGS[candidate] === groupSlug);

    if (!key) continue;

    const storePrice = item.storeOptionAvailabilities[0]?.price_cents;

    catalog[key].push({
      id: item.id,
      slug: item.slug,
      name: item.name,
      price_cents: typeof storePrice === "number" ? storePrice : item.price_cents,
    });
  }

  return catalog;
}
