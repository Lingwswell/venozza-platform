import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: ReturnType<typeof getPrismaClient> | undefined
}

function getPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    }),
  })
}

export const prisma = global.prisma ?? getPrismaClient()

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma
}
