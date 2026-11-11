import { getAdminScope, type AdminScope } from "@/lib/auth/scope";

type LegacyRole = "super_admin" | "owner" | "operator" | "customer";

/**
 * Adaptador para rotas antigas que pensam em "owner" (rede toda) x "operator" (loja).
 * - role "owner": dono da rede / super_admin
 * - role "operator": qualquer papel de loja (franqueado, gerente, operador),
 *   limitado a scope.storeIds
 * Lanca ScopeError quando a sessao e invalida ou sem permissao.
 */
export async function getLegacyAdminContext(req: Request): Promise<{
  tenantId: string;
  currentStoreId: string | null;
  role: LegacyRole;
  scope: AdminScope;
}> {
  const scope = await getAdminScope(req);
  return {
    tenantId: scope.tenantId,
    currentStoreId: scope.primaryStoreId,
    role: scope.networkWide ? "owner" : "operator",
    scope,
  };
}
