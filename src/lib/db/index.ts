let prisma: unknown = null;

try {
  // placeholder seguro para a Fase 1
  // quando o Prisma estiver fechado, substituímos pelo client real
  prisma = null;
} catch {
  prisma = null;
}

export { prisma };
export default prisma;
