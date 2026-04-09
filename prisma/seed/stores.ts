import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function seedStores() {
  console.log("🏪 Criando tenant e lojas base...");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "venozza" },
    update: {
      name: "VenoZza",
      active: true,
    },
    create: {
      name: "VenoZza",
      slug: "venozza",
      active: true,
    },
  });

  const stores = [
    {
      name: "VenoZza Centro",
      slug: "centro",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
    {
      name: "VenoZza Zona Sul",
      slug: "zona-sul",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: store.slug,
        },
      },
      update: {
        name: store.name,
        city: store.city,
        state: store.state,
        active: store.active,
      },
      create: {
        tenantId: tenant.id,
        name: store.name,
        slug: store.slug,
        city: store.city,
        state: store.state,
        active: store.active,
      },
    });
  }

  console.log("✅ Tenant e lojas base criados");
}
