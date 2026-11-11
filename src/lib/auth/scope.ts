import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContextFromRequest } from "@/lib/auth/context";
import { isNetworkRole, normalizeRole, type Role } from "@/lib/auth/roles";

// Escopo de acesso de um usuario do admin, sempre calculado no servidor a partir
// do token validado + banco. Nunca usa cabecalhos enviados pelo navegador
// (x-user-role, x-tenant-id, x-store-id) para dar permissao.

export type AdminScope = {
  userId: string;
  email: string;
  role: Role;
  tenantId: string;
  /** Dono da rede / super_admin: todas as lojas da rede. */
  networkWide: boolean;
  /** Lojas que o usuario pode acessar (para networkWide: todas as lojas da rede). */
  storeIds: string[];
  /** Loja principal do usuario (padrao das telas de uma loja so). */
  primaryStoreId: string | null;
};

export class ScopeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getAdminScope(req: Request): Promise<AdminScope> {
  let auth: Awaited<ReturnType<typeof getAuthContextFromRequest>>;
  try {
    auth = await getAuthContextFromRequest(req);
  } catch {
    throw new ScopeError("Sessão expirada ou inválida. Entre novamente.", 401);
  }

  const role = normalizeRole(auth.role);
  if (!role) throw new ScopeError("Acesso administrativo obrigatório.", 403);
  if (!auth.tenantId) throw new ScopeError("Usuário sem rede vinculada.", 403);

  const networkWide = isNetworkRole(role);

  let storeIds: string[];
  if (networkWide) {
    const stores = await prisma.store.findMany({
      where: { tenantId: auth.tenantId },
      select: { id: true },
    });
    storeIds = stores.map((s) => s.id);
  } else {
    const links = await prisma.userStore.findMany({
      where: { userId: auth.userId, store: { tenantId: auth.tenantId } },
      select: { storeId: true },
    });
    storeIds = links.map((l) => l.storeId);

    if (auth.storeId && !storeIds.includes(auth.storeId)) {
      const own = await prisma.store.findFirst({
        where: { id: auth.storeId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (own) storeIds.push(own.id);
    }
  }

  const primaryStoreId =
    auth.storeId && storeIds.includes(auth.storeId) ? auth.storeId : storeIds[0] ?? null;

  return {
    userId: auth.userId,
    email: auth.email,
    role,
    tenantId: auth.tenantId,
    networkWide,
    storeIds,
    primaryStoreId,
  };
}

export function canAccessStore(scope: AdminScope, storeId: string | null | undefined) {
  return !!storeId && scope.storeIds.includes(storeId);
}

/**
 * Filtro de loja para consultas (pedidos, relatorios, KDS...).
 * - Loja pedida: precisa estar no escopo (senao 403).
 * - Sem loja pedida: rede inteira para networkWide; senao so as lojas do usuario.
 */
export function storeFilter(
  scope: AdminScope,
  requestedStoreId?: string | null
): { storeId?: string | { in: string[] } } {
  const requested = requestedStoreId?.trim();

  if (requested && requested !== "all") {
    if (!canAccessStore(scope, requested)) {
      throw new ScopeError("Você não tem acesso a esta loja.", 403);
    }
    return { storeId: requested };
  }

  return scope.networkWide ? {} : { storeId: { in: scope.storeIds } };
}

/** Resposta padrao para ScopeError (ou null se o erro for outro). */
export function scopeErrorResponse(error: unknown) {
  if (error instanceof ScopeError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}
