import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { isNetworkRole } from "@/lib/auth/roles";
import { tenantSiteUrl } from "@/lib/billing/server";
import { SampleMenuError, createSampleMenu } from "@/lib/billing/sample-menu";

// Primeiros passos da rede nova: marca, primeira loja, cardapio e site no ar.

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!isNetworkRole(scope.role)) return NextResponse.json({ ok: false, error: "Só o dono da rede." }, { status: 403 });

    const tenant = await prisma.tenant.findUnique({
      where: { id: scope.tenantId },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        brandColor: true,
        onboardedAt: true,
        domains: { select: { host: true } },
      },
    });
    if (!tenant) return NextResponse.json({ ok: false, error: "Rede não encontrada." }, { status: 404 });

    const [stores, products, groups] = await Promise.all([
      prisma.store.count({ where: { tenantId: scope.tenantId, active: true } }),
      prisma.product.count({ where: { tenantId: scope.tenantId } }),
      prisma.optionGroup.count({ where: { tenantId: scope.tenantId } }),
    ]);

    return NextResponse.json({
      ok: true,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      brandColor: tenant.brandColor,
      onboarded: Boolean(tenant.onboardedAt),
      stores,
      products,
      optionGroups: groups,
      siteUrl: tenantSiteUrl(tenant.slug, tenant.domains.map((d) => d.host)),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/onboarding][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao carregar." }, { status: 500 });
  }
}

// body.action: brand (name, logoUrl, brandColor) | sample_menu | finish
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!isNetworkRole(scope.role)) return NextResponse.json({ ok: false, error: "Só o dono da rede." }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "brand") {
      const name = String(body.name || "").trim().slice(0, 80);
      if (name.length < 2) return NextResponse.json({ ok: false, error: "Informe o nome da marca." }, { status: 400 });
      const logoUrl = String(body.logoUrl || "").trim();
      if (logoUrl && !logoUrl.startsWith("/media/") && !/^https:\/\//.test(logoUrl)) {
        return NextResponse.json({ ok: false, error: "Logo inválido." }, { status: 400 });
      }
      const brandColor = String(body.brandColor || "").trim();
      if (brandColor && !COLOR_RE.test(brandColor)) {
        return NextResponse.json({ ok: false, error: "Cor inválida." }, { status: 400 });
      }
      await prisma.tenant.update({
        where: { id: scope.tenantId },
        data: { name, logoUrl: logoUrl || null, brandColor: brandColor || null },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "sample_menu") {
      const result = await createSampleMenu(scope.tenantId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "finish") {
      await prisma.tenant.update({ where: { id: scope.tenantId }, data: { onboardedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof SampleMenuError) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    }
    console.error("[api/admin/onboarding][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao salvar." }, { status: 500 });
  }
}
