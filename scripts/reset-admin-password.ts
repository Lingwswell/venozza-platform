import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const hash = await bcrypt.hash("123456", 10);

  const user = await prisma.user.update({
    where: { email: "admin@venozza.com" },
    data: { password: hash },
    select: { id: true, email: true, role: true },
  });

  console.log("OK senha atualizada:", user);
}

main()
  .catch((err) => {
    console.error("Erro ao resetar senha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
