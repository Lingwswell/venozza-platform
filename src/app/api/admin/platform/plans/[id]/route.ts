import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertPlatformAdmin } from "@/lib/billing/server";
import { PlanInputError, parsePlanInput } from "@/lib/billing/plan-input";
import { syncSubscriptionValue } from "@/lib/billing/sync";

// Editar plano. Mudou o valor: atualiza as assinaturas das redes nesse plano (proximas faturas).
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const current = await prisma.plan.findUnique({ where: { id }, select: { slug: true, priceCents: true } });
    if (!current) return NextResponse.json({ ok: false, error: "Plano não encontrado." }, { status: 404 });

    const data = parsePlanInput((await req.json().catch(() => ({}))) as Record<string, unknown>);
    await prisma.plan.update({ where: { id }, data: { ...data, slug: current.slug } });

    let failed = 0;
    if (data.priceCents !== current.priceCents) {
      const tenants = await prisma.tenant.findMany({
        where: { planId: id, asaasSubscriptionId: { not: null } },
        select: { id: true },
      });
      for (const t of tenants) {
        await syncSubscriptionValue(t.id).catch((error) => {
          failed += 1;
          console.warn("[platform][plan][sync]", t.id, error);
        });
      }
    }
    return NextResponse.json({ ok: true, failed });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof PlanInputError) return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    console.error("[api/admin/platform/plans/:id][PATCH]", error);
    return NextResponse.json({ ok: false, error: "Erro ao salvar o plano." }, { status: 500 });
  }
}
