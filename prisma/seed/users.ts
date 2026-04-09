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

export async function seedUsers() {
  console.log("👤 Criando usuários base...");

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "venozza" },
  });

  if (!tenant) {
    throw new Error("Tenant não encontrado.");
  }

  const centro = await prisma.store.findFirst({
    where: {
      tenantId: tenant.id,
      slug: "centro",
    },
  });

  if (!centro) {
    throw new Error("Store não encontrada.");
  }

  await prisma.user.upsert({
    where: { email: "admin@venozza.com" },
    update: {
      name: "Administrador VenoZza",
      role: "owner",
      active: true,
      tenantId: tenant.id,
      storeId: null,
    },
    create: {
      name: "Administrador VenoZza",
      email: "admin@venozza.com",
      password: "123456",
      role: "owner",
      active: true,
      tenantId: tenant.id,
      storeId: null,
    },
  });

  await prisma.user.upsert({
    where: { email: "operador.centro@venozza.com" },
    update: {
      name: "Operador Centro",
      role: "operator",
      active: true,
      tenantId: tenant.id,
      storeId: centro.id,
    },
    create: {
      name: "Operador Centro",
      email: "operador.centro@venozza.com",
      password: "123456",
      role: "operator",
      active: true,
      tenantId: tenant.id,
      storeId: centro.id,
    },
  });

  console.log("✅ Usuários base criados");
}
