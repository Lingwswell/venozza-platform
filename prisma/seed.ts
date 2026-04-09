import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const adminEmail = "admin@venozza.com";

  const store = await prisma.store.upsert({
    where: { slug: "centro" },
    update: {},
    create: {
      name: "VenoZza Centro",
      slug: "centro",
    },
  });

  console.log("✅ Loja criada:", store.name);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Administrador",
      email: adminEmail,
      password:
        "$2b$10$wYQxH2wGvS3xD9lYV8mN0e6v0EwXlYv8x0mM7Q5m2D2k7iQmQx9QW",
      role: "SUPER_ADMIN",
    },
  });

  console.log("✅ Usuário admin criado");

  const products = [
    {
      name: "Pizza Mussarela",
      description: "Molho especial, mussarela e orégano.",
      imageUrl: "/images/produtos/mussarela.jpg",
      basePrice: 39.9,
      isAvailable: true,
      storeId: store.id,
    },
    {
      name: "Pizza Calabresa",
      description: "Calabresa fatiada, cebola e molho da casa.",
      imageUrl: "/images/produtos/calabresa.jpg",
      basePrice: 42.9,
      isAvailable: true,
      storeId: store.id,
    },
    {
      name: "Frango com Catupiry",
      description: "Frango temperado com cobertura cremosa.",
      imageUrl: "/images/produtos/frango-catupiry.jpg",
      basePrice: 44.9,
      isAvailable: true,
      storeId: store.id,
    },
    {
      name: "Coca-Cola 2L",
      description: "Refrigerante gelado 2 litros.",
      imageUrl: "/images/produtos/coca-2l.jpg",
      basePrice: 12.9,
      isAvailable: true,
      storeId: store.id,
    },
    {
      name: "Guaraná 2L",
      description: "Refrigerante gelado 2 litros.",
      imageUrl: "/images/produtos/guarana-2l.jpg",
      basePrice: 10.9,
      isAvailable: true,
      storeId: store.id,
    },
    {
      name: "Petit Gateau",
      description: "Sobremesa quente com recheio cremoso.",
      imageUrl: "/images/produtos/petit-gateau.jpg",
      basePrice: 18.9,
      isAvailable: true,
      storeId: store.id,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        // precisa de unique composto no schema: @@unique([storeId, name])
        // se não tiver, usa findFirst + create como estava antes
        storeId_name: {
          storeId: product.storeId,
          name: product.name,
        },
      },
      update: {},
      create: product,
    });
  }

  console.log("✅ Produtos criados");
  console.log("🎉 Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });