import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertPlatformAdmin } from "@/lib/billing/server";
import { AddonInputError, parseAddonInput } from "@/lib/billing/addon-input";
import { forgetFeatures } from "@/lib/billing/features";
import { syncSubscriptionValue } from "@/lib/billing/sync";

// Editar adicional. Mudou o valor: atualiza as assinaturas de quem contratou.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const current = await prisma.addon.findUnique({ where: { id }, select: { slug: true, priceCents: true, active: true } });
    if (!current) return NextResponse.json({ ok: false, error: "Adicional não encontrado." }, { status: 404 });

    const data = parseAddonInput((await req.json().catch(() => ({}))) as Record<string, unknown>);
    await prisma.addon.update({ where: { id }, data: { ...data, slug: current.slug } });
    forgetFeatures();

    let failed = 0;
    if (data.priceCents !== current.priceCents || data.active !== current.active) {
      const links = await prisma.tenantAddon.findMany({ where: { addonId: id }, select: { tenantId: true } });
      for (const link of links) {
        await syncSubscriptionValue(link.tenantId).catch((error) => {
          failed += 1;
          console.warn("[platform][addon][sync]", link.tenantId, error);
        });
      }
    }
    return NextResponse.json({ ok: true, failed });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof AddonInputError) return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    console.error("[api/admin/platform/addons/:id][PATCH]", error);
    return NextResponse.json({ ok: false, error: "Erro ao salvar o adicional." }, { status: 500 });
  }
}
