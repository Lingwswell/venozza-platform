import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertPlatformAdmin } from "@/lib/billing/server";
import { PlanInputError, parsePlanInput } from "@/lib/billing/plan-input";

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { tenants: true } } },
    });
    return NextResponse.json({ ok: true, plans });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/platform/plans][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar planos." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const data = parsePlanInput((await req.json().catch(() => ({}))) as Record<string, unknown>);
    const exists = await prisma.plan.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (exists) data.slug = `${data.slug}-${Date.now().toString(36)}`;
    const plan = await prisma.plan.create({ data });
    return NextResponse.json({ ok: true, plan }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof PlanInputError) return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    console.error("[api/admin/platform/plans][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao criar o plano." }, { status: 500 });
  }
}
