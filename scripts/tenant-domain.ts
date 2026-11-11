// Gerencia os dominios de cada rede (tenant).
//
//   npx tsx scripts/tenant-domain.ts list
//   npx tsx scripts/tenant-domain.ts add <slug-da-rede> <dominio>
//   npx tsx scripts/tenant-domain.ts remove <dominio>
//
// Ex.: npx tsx scripts/tenant-domain.ts add venozza pedidos.venozza.com.br
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function normalizeHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

async function main() {
  const [command, a, b] = process.argv.slice(2);

  if (command === "list" || !command) {
    const tenants = await prisma.tenant.findMany({
      select: { slug: true, name: true, active: true, domains: { select: { host: true } } },
      orderBy: { name: "asc" },
    });
    for (const t of tenants) {
      const hosts = t.domains.map((d) => d.host).join(", ") || "(sem domínio)";
      console.log(`${t.slug.padEnd(20)} ${t.name.padEnd(25)} ${t.active ? "ativa " : "inativa"}  ${hosts}`);
    }
    return;
  }

  if (command === "add" && a && b) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: a } });
    if (!tenant) throw new Error(`Rede "${a}" não encontrada. Use "list" para ver os slugs.`);
    const host = normalizeHost(b);
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id },
      create: { host, tenantId: tenant.id },
    });
    console.log(`OK: ${host} → ${tenant.name}`);
    return;
  }

  if (command === "remove" && a) {
    const host = normalizeHost(a);
    await prisma.tenantDomain.delete({ where: { host } });
    console.log(`OK: ${host} removido`);
    return;
  }

  console.log("Uso: list | add <slug-da-rede> <dominio> | remove <dominio>");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
