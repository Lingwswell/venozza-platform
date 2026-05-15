import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATALOG = [
  { name: "Pizza Mussarela",    description: "Molho especial, mussarela e orégano.",       image: "/images/produtos/mussarela.jpg",       price_cents: 3990, available: true, category: "pizzas"     },
  { name: "Pizza Calabresa",    description: "Calabresa fatiada, cebola e molho da casa.",  image: "/images/produtos/calabresa.jpg",        price_cents: 4290, available: true, category: "pizzas"     },
  { name: "Frango com Catupiry",description: "Frango temperado com cobertura cremosa.",     image: "/images/produtos/frango-catupiry.jpg",  price_cents: 4490, available: true, category: "pizzas"     },
  { name: "Coca-Cola 2L",       description: "Refrigerante gelado 2 litros.",               image: "/images/produtos/coca-2l.jpg",          price_cents: 1290, available: true, category: "bebidas"    },
  { name: "Guaraná 2L",         description: "Refrigerante gelado 2 litros.",               image: "/images/produtos/guarana-2l.jpg",       price_cents: 1090, available: true, category: "bebidas"    },
  { name: "Petit Gateau",       description: "Sobremesa quente com recheio cremoso.",       image: "/images/produtos/petit-gateau.jpg",     price_cents: 1890, available: true, category: "sobremesas" },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "venozza" },
    update: { active: true, name: "VenoZza" },
    create: { name: "VenoZza", slug: "venozza", active: true },
  });
  console.log("✅ Tenant:", tenant.name);

  const store = await prisma.store.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "centro" } },
    update: { name: "VenoZza Centro", active: true },
    create: { tenantId: tenant.id, name: "VenoZza Centro", slug: "centro", city: "São Paulo", state: "SP", active: true },
  });
  console.log("✅ Loja:", store.name);

  await prisma.user.upsert({
    where: { email: "admin@venozza.com" },
    update: { tenantId: tenant.id, storeId: store.id, role: "owner", active: true },
    create: { tenantId: tenant.id, storeId: store.id, name: "Administrador", email: "admin@venozza.com", password: "$2b$10$wYQxH2wGvS3xD9lYV8mN0e6v0EwXlYv8x0mM7Q5m2D2k7iQmQx9QW", role: "owner", active: true },
  });
  console.log("✅ Usuário admin ok");

  for (const item of CATALOG) {
    const existing = await prisma.product.findFirst({
      where: {
        storeId: store.id,
        name: item.name,
      },
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...item,
            storeId: store.id,
          },
        })
      : await prisma.product.create({
          data: {
            ...item,
            storeId: store.id,
          },
        });

    await prisma.productStore.upsert({
      where: { productId_storeId: { productId: product.id, storeId: store.id } },
      update: { available: true, stock: 50 },
      create: { productId: product.id, storeId: store.id, available: true, stock: 50, price_cents: null },
    });
    console.log("  ↳", product.name);
  }

  console.log("✅ Catálogo vinculado à loja");
  console.log("🎉 Seed concluído!");
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
