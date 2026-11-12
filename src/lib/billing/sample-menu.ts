import { prisma } from "@/lib/db";

// Cardapio de exemplo para uma rede nova: opcoes da pizza (tamanho, borda, massa, bebidas),
// categorias e alguns produtos em todas as lojas ativas. Nao mexe no que ja existir.

type SeedItem = { name: string; slug: string; price_cents: number; description?: string };
type SeedGroup = {
  name: string;
  slug: string;
  type: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  items: SeedItem[];
};

const GROUPS: SeedGroup[] = [
  {
    name: "Tamanho da pizza",
    slug: "pizza-tamanho",
    type: "size",
    required: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 10,
    items: [
      { name: "Pizza Pequena - 25cm", slug: "pizza-pequena-25cm", price_cents: -1000, description: "Ideal para 1 pessoa." },
      { name: "Pizza Grande - 35cm", slug: "pizza-grande-35cm", price_cents: 0, description: "8 fatias." },
      { name: "Pizza Família - 40cm", slug: "pizza-familia-40cm", price_cents: 2000, description: "12 fatias." },
    ],
  },
  {
    name: "Borda",
    slug: "pizza-borda",
    type: "crust",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 20,
    items: [
      { name: "Borda sem recheio", slug: "borda-sem-recheio", price_cents: 0 },
      { name: "Borda Catupiry", slug: "borda-catupiry", price_cents: 1290 },
      { name: "Borda Cheddar", slug: "borda-cheddar", price_cents: 1290 },
    ],
  },
  {
    name: "Massa",
    slug: "pizza-massa",
    type: "dough",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 30,
    items: [
      { name: "Massa Tradicional", slug: "massa-tradicional", price_cents: 0 },
      { name: "Massa Fina", slug: "massa-fina", price_cents: 0 },
    ],
  },
  {
    name: "Bebidas junto da pizza",
    slug: "pizza-bebidas",
    type: "addon",
    required: false,
    minSelect: 0,
    maxSelect: 10,
    sortOrder: 40,
    items: [
      { name: "Refrigerante 2L", slug: "refrigerante-2l", price_cents: 1400 },
      { name: "Refrigerante lata", slug: "refrigerante-lata", price_cents: 700 },
    ],
  },
];

const CATEGORIES = [
  { name: "Pizzas", slug: "pizzas", icon: "🍕", sortOrder: 10 },
  { name: "Bebidas", slug: "bebidas", icon: "🥤", sortOrder: 20 },
  { name: "Sobremesas", slug: "sobremesas", icon: "🍫", sortOrder: 30 },
];

const PRODUCTS = [
  { name: "Mussarela", category: "pizzas", price_cents: 4490, description: "Molho de tomate, mussarela e orégano." },
  { name: "Calabresa", category: "pizzas", price_cents: 4690, description: "Calabresa fatiada, cebola e mussarela." },
  { name: "Margherita", category: "pizzas", price_cents: 4890, description: "Mussarela, tomate e manjericão." },
  { name: "Frango com Catupiry", category: "pizzas", price_cents: 5290, description: "Frango desfiado e catupiry." },
  { name: "Refrigerante 2L", category: "bebidas", price_cents: 1400, description: null },
  { name: "Brownie", category: "sobremesas", price_cents: 1490, description: "Brownie de chocolate." },
];

export class SampleMenuError extends Error {}

export async function createSampleMenu(tenantId: string) {
  const stores = await prisma.store.findMany({ where: { tenantId, active: true }, select: { id: true } });
  if (stores.length === 0) throw new SampleMenuError("Crie a primeira loja antes do cardápio de exemplo.");

  let createdGroups = 0;
  for (const group of GROUPS) {
    const exists = await prisma.optionGroup.findUnique({
      where: { tenantId_slug: { tenantId, slug: group.slug } },
      select: { id: true },
    });
    if (exists) continue;
    const { items, ...data } = group;
    await prisma.optionGroup.create({
      data: {
        ...data,
        tenantId,
        active: true,
        items: {
          create: items.map((item, index) => ({ ...item, tenantId, sortOrder: (index + 1) * 10, active: true })),
        },
      },
    });
    createdGroups += 1;
  }

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: category.slug } },
      create: { ...category, tenantId, active: true, showInMobile: true, showInSite: true },
      update: {},
    });
  }

  const hasProducts = await prisma.product.count({ where: { tenantId } });
  let createdProducts = 0;
  if (hasProducts === 0) {
    for (const p of PRODUCTS) {
      // Um cadastro por rede; o vinculo com cada loja fica em product_stores.
      await prisma.product.create({
        data: {
          tenantId,
          storeId: stores[0].id,
          name: p.name,
          category: p.category,
          price_cents: p.price_cents,
          description: p.description,
          available: true,
          productStores: {
            create: stores.map((s) => ({ storeId: s.id, available: true, stock: 999, price_cents: p.price_cents })),
          },
        },
      });
      createdProducts += 1;
    }
  }

  return { createdGroups, createdProducts };
}
