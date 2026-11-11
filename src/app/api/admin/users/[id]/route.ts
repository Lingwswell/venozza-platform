import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { can, normalizeRole } from "@/lib/auth/roles";
import {
  UserRuleError,
  canManageUser,
  ensureAnotherActiveOwner,
  serializeUser,
  userPublicSelect,
  validatePassword,
  validateRoleAndStores,
} from "@/lib/users/admin-users";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Editar usuario: nome, papel, lojas, ativo e redefinir senha.
// Ninguem edita o proprio papel/lojas/status (evita se trancar fora).
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    if (!can.manageUsers(scope.role)) return fail("Sem permissão para editar usuários.", 403);

    const target = await prisma.user.findFirst({
      where: { id, tenantId: scope.tenantId },
      select: userPublicSelect,
    });
    if (!target) return fail("Usuário não encontrado", 404);
    if (!canManageUser(scope, target)) return fail("Você não pode editar este usuário.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: {
      name?: string;
      role?: string;
      active?: boolean;
      password?: string;
      storeId?: string | null;
    } = {};

    if ("name" in body) {
      const name = String(body.name ?? "").trim().slice(0, 80);
      if (!name) throw new UserRuleError("Nome é obrigatório.");
      data.name = name;
    }

    let nextStoreIds: string[] | null = null;
    if ("role" in body || "storeIds" in body) {
      const { role, storeIds } = validateRoleAndStores(
        scope,
        "role" in body ? body.role : target.role,
        "storeIds" in body ? body.storeIds : target.stores.map((s) => s.store.id)
      );
      data.role = role;
      nextStoreIds = storeIds;
      data.storeId = storeIds[0] ?? null;
    }

    if ("active" in body) data.active = body.active !== false;

    if (typeof body.password === "string" && body.password) {
      data.password = await bcrypt.hash(validatePassword(body.password), 10);
    }

    // Tirar o ultimo dono ativo (desativando ou mudando o papel) nao pode.
    const wasOwner = normalizeRole(target.role) === "owner" && target.active;
    const stillOwner = (data.role ?? "owner") === "owner" && data.active !== false;
    if (wasOwner && !stillOwner) await ensureAnotherActiveOwner(scope.tenantId, target.id);

    const user = await prisma.$transaction(async (tx) => {
      if (nextStoreIds) {
        await tx.userStore.deleteMany({ where: { userId: id } });
        if (nextStoreIds.length > 0) {
          await tx.userStore.createMany({
            data: nextStoreIds.map((storeId) => ({ userId: id, storeId })),
          });
        }
      }
      return tx.user.update({ where: { id }, data, select: userPublicSelect });
    });

    return NextResponse.json({ ok: true, user: serializeUser(user) });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof UserRuleError) return fail(error.message, error.status);
    console.error("[api/admin/users/:id][PATCH]", error);
    return fail("Erro ao salvar usuário", 500);
  }
}
