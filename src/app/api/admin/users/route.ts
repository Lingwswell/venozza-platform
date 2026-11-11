import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, assignableRoles, can } from "@/lib/auth/roles";
import {
  STORE_BOUND_ROLES,
  UserRuleError,
  canManageUser,
  serializeUser,
  userPublicSelect,
  validateEmail,
  validatePassword,
  validateRoleAndStores,
} from "@/lib/users/admin-users";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Lista a equipe que o usuario logado pode ver e os dados do formulario.
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageUsers(scope.role)) return fail("Sem permissão para gerenciar usuários.", 403);

    const users = await prisma.user.findMany({
      where: {
        tenantId: scope.tenantId,
        ...(scope.networkWide
          ? {}
          : { stores: { some: { storeId: { in: scope.storeIds } } } }),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: userPublicSelect,
    });

    const stores = await prisma.store.findMany({
      where: { tenantId: scope.tenantId, id: { in: scope.storeIds }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const roles = assignableRoles(scope.role).map((role) => ({
      value: role,
      label: ROLE_LABELS[role],
      description: ROLE_DESCRIPTIONS[role],
      needsStores: STORE_BOUND_ROLES.includes(role),
    }));

    return NextResponse.json({
      ok: true,
      me: { id: scope.userId, role: scope.role },
      roles,
      stores,
      users: users.map((u) => ({ ...serializeUser(u), canEdit: canManageUser(scope, u) })),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/users][GET]", error);
    return fail("Erro ao listar usuários", 500);
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!can.manageUsers(scope.role)) return fail("Sem permissão para criar usuários.", 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = String(body.name ?? "").trim().slice(0, 80);
    if (!name) throw new UserRuleError("Nome é obrigatório.");

    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    const { role, storeIds } = validateRoleAndStores(scope, body.role, body.storeIds);

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new UserRuleError("Já existe um usuário com este e-mail.", 409);

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        tenantId: scope.tenantId,
        name,
        email,
        password: hash,
        role,
        active: true,
        storeId: storeIds[0] ?? null,
        stores: { create: storeIds.map((storeId) => ({ storeId })) },
      },
      select: userPublicSelect,
    });

    return NextResponse.json({ ok: true, user: serializeUser(user) }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof UserRuleError) return fail(error.message, error.status);
    console.error("[api/admin/users][POST]", error);
    return fail("Erro ao criar usuário", 500);
  }
}
