import { NextResponse } from "next/server";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { isPlatformAdmin, tenantBillingState } from "@/lib/billing/server";
import { prisma } from "@/lib/db";

// Situacao resumida da assinatura (aviso no topo do admin e itens do menu).
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    const [state, tenant] = await Promise.all([
      tenantBillingState(scope.tenantId),
      prisma.tenant.findUnique({ where: { id: scope.tenantId }, select: { onboardedAt: true, planId: true } }),
    ]);
    return NextResponse.json({
      ok: true,
      state,
      platformAdmin: isPlatformAdmin(scope),
      // Rede criada pelo SaaS (tem plano) e ainda nao terminou os primeiros passos.
      needsOnboarding: Boolean(tenant?.planId) && !tenant?.onboardedAt,
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/billing/status][GET]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
