import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";

export type AuthContext = {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
  storeId: string | null;
};

type JwtPayloadShape = {
  userId?: string;
  sub?: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
  storeId?: string | null;
};

export async function getAuthContextFromRequest(
  req: Request,
  options: { allowPublic?: boolean } = {}
): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  const roleHeader = req.headers.get("x-user-role");
  const tenantHeader = req.headers.get("x-tenant-id");
  const storeHeader = req.headers.get("x-store-id");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET não configurado");

    const payload = jwt.verify(token, secret) as JwtPayloadShape;

    const resolvedUserId =
      (typeof payload.userId === "string" && payload.userId.trim()) ||
      (typeof payload.sub === "string" && payload.sub.trim()) ||
      null;

    const resolvedEmail =
      (typeof payload.email === "string" && payload.email.trim()) || null;

    if (!resolvedUserId && !resolvedEmail) {
      throw new Error("Token inválido: userId/sub ou email ausente.");
    }

    const user = await prisma.user.findFirst({
      where: resolvedUserId
        ? { id: resolvedUserId }
        : { email: resolvedEmail! },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        storeId: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      throw new Error("Usuário inválido ou inativo.");
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? payload.tenantId ?? null,
      storeId: user.storeId ?? payload.storeId ?? null,
    };
  }

  // Fluxo público/mobile: loja identificada pelos headers.
  // Headers nunca concedem papel administrativo.
  if (options.allowPublic && storeHeader) {
    return {
      userId: "public-client",
      email: "public@venozza",
      role: "customer",
      tenantId: null,
      storeId: storeHeader,
    };
  }

  throw new Error("Authorization ou x-store-id é obrigatório");
}
