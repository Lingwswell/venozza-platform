import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertPlatformAdmin } from "@/lib/billing/server";
import { AddonInputError, parseAddonInput } from "@/lib/billing/addon-input";
import { forgetFeatures } from "@/lib/billing/features";

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const addons = await prisma.addon.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { tenants: true } } },
    });
    return NextResponse.json({ ok: true, addons });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/platform/addons][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar adicionais." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const data = parseAddonInput((await req.json().catch(() => ({}))) as Record<string, unknown>);
    const exists = await prisma.addon.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (exists) data.slug = `${data.slug}-${Date.now().toString(36)}`;
    const addon = await prisma.addon.create({ data });
    forgetFeatures();
    return NextResponse.json({ ok: true, addon }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof AddonInputError) return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    console.error("[api/admin/platform/addons][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao criar o adicional." }, { status: 500 });
  }
}
