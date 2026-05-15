import { prisma } from "../src/lib/db";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

type SeedItem = {
  name: string;
  slug?: string;
  description?: string;
  price_cents: number;
  sortOrder?: number;
};

type SeedGroup = {
  name: string;
  slug: string;
  description?: string;
  type: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  categorySlugs: string[];
  items: SeedItem[];
};

const groups: SeedGroup[] = [
  {
    name: "Tamanho da pizza",
    slug: "tamanho-da-pizza",
    description: "Tamanhos disponíveis para pizzas.",
    type: "size",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 10,
    categorySlugs: ["pizza", "pizzas"],
    items: [
      {
        name: "Pizza Pequena - 25cm",
        slug: "pizza-pequena-25cm",
        description: "Ideal para 1 pessoa.",
        price_cents: -1000,
        sortOrder: 10,
      },
      {
        name: "Pizza Grande - 35cm",
        slug: "pizza-grande-35cm",
        description: "Aproximadamente 8 fatias.",
        price_cents: 0,
        sortOrder: 20,
      },
      {
        name: "Pizza Família - 40cm",
        slug: "pizza-familia-40cm",
        description: "Tamanho família com 1 sabor.",
        price_cents: 2000,
        sortOrder: 30,
      },
    ],
  },
  {
    name: "Borda",
    slug: "borda",
    description: "Bordas recheadas para pizzas.",
    type: "crust",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 20,
    categorySlugs: ["pizza", "pizzas"],
    items: [
      { name: "Borda sem recheio", slug: "borda-sem-recheio", price_cents: 0, sortOrder: 10 },
      { name: "Borda Catupiry", slug: "borda-catupiry", price_cents: 1590, sortOrder: 20 },
      { name: "Borda Cream Cheese", slug: "borda-cream-cheese", price_cents: 1590, sortOrder: 30 },
      { name: "Borda Muçarela", slug: "borda-mucarela", price_cents: 1790, sortOrder: 40 },
      { name: "Borda Calabresa c/ Catupiry", slug: "borda-calabresa-catupiry", price_cents: 1790, sortOrder: 50 },
      { name: "Borda Chocolate ao Leite", slug: "borda-chocolate-ao-leite", price_cents: 1090, sortOrder: 60 },
      { name: "Borda Creme de Avelã", slug: "borda-creme-de-avela", price_cents: 1390, sortOrder: 70 },
    ],
  },
  {
    name: "Massa",
    slug: "massa",
    description: "Tipos de massa disponíveis.",
    type: "dough",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 30,
    categorySlugs: ["pizza", "pizzas"],
    items: [
      { name: "Massa Tradicional", slug: "massa-tradicional", price_cents: 0, sortOrder: 10 },
      { name: "Massa Integral", slug: "massa-integral", price_cents: 400, sortOrder: 20 },
    ],
  },
  {
    name: "Bebidas extras",
    slug: "bebidas-extras",
    description: "Bebidas adicionais oferecidas junto ao produto.",
    type: "addon",
    required: false,
    minSelect: 0,
    maxSelect: 10,
    sortOrder: 40,
    categorySlugs: ["pizza", "pizzas"],
    items: [
      { name: "Guaraná Antarctica - 1,5L", slug: "guarana-antarctica-15l", price_cents: 1290, sortOrder: 10 },
      { name: "Guaraná Antarctica - 2L", slug: "guarana-antarctica-2l", price_cents: 1490, sortOrder: 20 },
      { name: "Pepsi - 1,5L", slug: "pepsi-15l", price_cents: 1290, sortOrder: 30 },
      { name: "Pepsi - 2L", slug: "pepsi-2l", price_cents: 1490, sortOrder: 40 },
    ],
  },
  {
    name: "Tamanho da batata",
    slug: "tamanho-da-batata",
    description: "Tamanhos disponíveis para batata.",
    type: "size",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 50,
    categorySlugs: ["acompanhamento", "acompanhamentos", "porcao", "porcoes"],
    items: [
      { name: "Batata Pequena", slug: "batata-pequena", description: "Porção menor.", price_cents: 0, sortOrder: 10 },
      { name: "Batata Média", slug: "batata-media", description: "Porção média.", price_cents: 500, sortOrder: 20 },
      { name: "Batata Grande", slug: "batata-grande", description: "Porção grande.", price_cents: 1000, sortOrder: 30 },
    ],
  },
  {
    name: "Recheios da batata",
    slug: "recheios-da-batata",
    description: "Recheios e adicionais para batata.",
    type: "filling",
    required: false,
    minSelect: 0,
    maxSelect: 10,
    sortOrder: 60,
    categorySlugs: ["acompanhamento", "acompanhamentos", "porcao", "porcoes"],
    items: [
      { name: "Sem recheio adicional", slug: "sem-recheio-adicional", price_cents: 0, sortOrder: 10 },
      { name: "Cheddar", slug: "cheddar", price_cents: 500, sortOrder: 20 },
      { name: "Catupiry", slug: "catupiry", price_cents: 500, sortOrder: 30 },
      { name: "Bacon", slug: "bacon", price_cents: 700, sortOrder: 40 },
      { name: "Calabresa", slug: "calabresa", price_cents: 700, sortOrder: 50 },
      { name: "Frango cremoso", slug: "frango-cremoso", price_cents: 800, sortOrder: 60 },
    ],
  },
];

async function main() {
  const tenant =
    (await prisma.tenant.findFirst({
      where: { slug: "venozza" },
      orderBy: { createdAt: "asc" },
    })) ||
    (await prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
    }));

  if (!tenant) {
    throw new Error("Nenhum tenant encontrado. Crie um tenant antes de rodar o seed de opções.");
  }

  const stores = await prisma.store.findMany({
    where: {
      tenantId: tenant.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const categories = await prisma.category.findMany({
    where: {
      tenantId: tenant.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  console.log("Tenant:", tenant.name, tenant.id);
  console.log("Lojas ativas:", stores.map((store) => `${store.name} (${store.slug})`).join(", ") || "nenhuma");
  console.log("Categorias ativas:", categories.map((category) => `${category.name} (${category.slug})`).join(", ") || "nenhuma");

  for (const groupSeed of groups) {
    const group = await prisma.optionGroup.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: groupSeed.slug,
        },
      },
      update: {
        name: groupSeed.name,
        description: groupSeed.description,
        type: groupSeed.type,
        required: groupSeed.required,
        minSelect: groupSeed.minSelect,
        maxSelect: groupSeed.maxSelect,
        sortOrder: groupSeed.sortOrder,
        active: true,
      },
      create: {
        tenantId: tenant.id,
        name: groupSeed.name,
        slug: groupSeed.slug,
        description: groupSeed.description,
        type: groupSeed.type,
        required: groupSeed.required,
        minSelect: groupSeed.minSelect,
        maxSelect: groupSeed.maxSelect,
        sortOrder: groupSeed.sortOrder,
        active: true,
      },
    });

    console.log("Grupo OK:", group.name);

    for (const [index, itemSeed] of groupSeed.items.entries()) {
      const itemSlug = itemSeed.slug || slugify(itemSeed.name);

      const item = await prisma.optionItem.upsert({
        where: {
          optionGroupId_slug: {
            optionGroupId: group.id,
            slug: itemSlug,
          },
        },
        update: {
          tenantId: tenant.id,
          name: itemSeed.name,
          description: itemSeed.description,
          price_cents: itemSeed.price_cents,
          sortOrder: itemSeed.sortOrder ?? index + 1,
          active: true,
        },
        create: {
          tenantId: tenant.id,
          optionGroupId: group.id,
          name: itemSeed.name,
          slug: itemSlug,
          description: itemSeed.description,
          price_cents: itemSeed.price_cents,
          sortOrder: itemSeed.sortOrder ?? index + 1,
          active: true,
        },
      });

      for (const store of stores) {
        await prisma.storeOptionAvailability.upsert({
          where: {
            storeId_optionItemId: {
              storeId: store.id,
              optionItemId: item.id,
            },
          },
          update: {
            available: true,
          },
          create: {
            storeId: store.id,
            optionItemId: item.id,
            available: true,
            stock: null,
            price_cents: null,
          },
        });
      }
    }

    const matchedCategories = categories.filter((category) =>
      groupSeed.categorySlugs.includes(category.slug)
    );

    for (const [index, category] of matchedCategories.entries()) {
      await prisma.categoryOptionGroup.upsert({
        where: {
          categoryId_optionGroupId: {
            categoryId: category.id,
            optionGroupId: group.id,
          },
        },
        update: {
          sortOrder: groupSeed.sortOrder + index,
          active: true,
        },
        create: {
          categoryId: category.id,
          optionGroupId: group.id,
          sortOrder: groupSeed.sortOrder + index,
          active: true,
        },
      });

      console.log(`Vínculo categoria OK: ${category.name} -> ${group.name}`);
    }

    if (matchedCategories.length === 0) {
      console.log(`Aviso: nenhum vínculo de categoria encontrado para o grupo ${group.name}`);
    }
  }

  const counts = {
    optionGroups: await prisma.optionGroup.count({ where: { tenantId: tenant.id } }),
    optionItems: await prisma.optionItem.count({ where: { tenantId: tenant.id } }),
    categoryOptionGroups: await prisma.categoryOptionGroup.count(),
    storeOptionAvailabilities: await prisma.storeOptionAvailability.count(),
  };

  console.log("Resumo:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
