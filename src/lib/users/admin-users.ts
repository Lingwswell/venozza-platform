import { prisma } from "@/lib/db";
import type { AdminScope } from "@/lib/auth/scope";
import { assignableRoles, normalizeRole, type Role } from "@/lib/auth/roles";

// Regras de quem pode ver/criar/editar quais usuarios.

export class UserRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Papeis que trabalham em loja(s) especificas e precisam de pelo menos uma loja. */
export const STORE_BOUND_ROLES: Role[] = ["franchisee", "manager", "operator"];

export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  storeId: true,
  createdAt: true,
  stores: { select: { store: { select: { id: true, name: true } } } },
} as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  storeId: string | null;
  createdAt: Date;
  stores: { store: { id: string; name: string } }[];
};

export function serializeUser(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    active: user.active,
    primaryStoreId: user.storeId,
    stores: user.stores.map((s) => s.store),
    createdAt: user.createdAt,
  };
}

/** O usuario logado pode gerenciar este usuario? */
export function canManageUser(scope: AdminScope, target: UserRow) {
  if (target.id === scope.userId) return false;
  const role = normalizeRole(target.role);
  if (!role || !assignableRoles(scope.role).includes(role)) return false;
  if (scope.networkWide) return true;

  // Usuario de loja: o alvo precisa trabalhar so em lojas que ele acessa.
  const targetStores = target.stores.map((s) => s.store.id);
  return targetStores.length > 0 && targetStores.every((id) => scope.storeIds.includes(id));
}

export function validateRoleAndStores(scope: AdminScope, roleRaw: unknown, storeIdsRaw: unknown) {
  const role = normalizeRole(roleRaw);
  if (!role || !assignableRoles(scope.role).includes(role)) {
    throw new UserRuleError("Você não pode atribuir este papel.", 403);
  }

  const storeIds = Array.isArray(storeIdsRaw)
    ? Array.from(new Set(storeIdsRaw.map((v) => String(v)).filter(Boolean)))
    : [];

  if (storeIds.some((id) => !scope.storeIds.includes(id))) {
    throw new UserRuleError("Uma das lojas escolhidas não pertence ao seu acesso.", 403);
  }

  if (STORE_BOUND_ROLES.includes(role) && storeIds.length === 0) {
    throw new UserRuleError("Escolha pelo menos uma loja para este usuário.");
  }

  return { role, storeIds };
}

export function validateEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserRuleError("E-mail inválido.");
  }
  return email;
}

export function validatePassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 8) {
    throw new UserRuleError("A senha precisa ter pelo menos 8 caracteres.");
  }
  return password;
}

/** Impede deixar a rede sem nenhum dono ativo. */
export async function ensureAnotherActiveOwner(tenantId: string, exceptUserId: string) {
  const count = await prisma.user.count({
    where: { tenantId, role: "owner", active: true, NOT: { id: exceptUserId } },
  });
  if (count === 0) {
    throw new UserRuleError("A rede precisa ter pelo menos um dono ativo.");
  }
}
