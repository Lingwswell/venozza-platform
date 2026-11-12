import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertPlatformAdmin, graceDays, tenantSiteUrl } from "@/lib/billing/server";
import { billingState, monthlyValueCents } from "@/lib/billing/state";
import { asaasConfigured } from "@/lib/billing/asaas";
import { NetworkInputError, createNetwork } from "@/lib/billing/network";

// Painel Redes (administrador da plataforma): todas as redes com situacao e numeros do mes.
export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [tenants, plans, orders] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          active: true,
          status: true,
          trialEndsAt: true,
          pastDueSince: true,
          suspendedReason: true,
          asaasSubscriptionId: true,
          billingEmail: true,
          createdAt: true,
          onboardedAt: true,
          plan: { select: { id: true, name: true, priceCents: true } },
          domains: { select: { host: true } },
          stores: { where: { active: true }, select: { id: true } },
          users: { where: { role: "owner", active: true }, select: { name: true, email: true }, take: 1 },
          invoices: {
            orderBy: { dueDate: "desc" },
            take: 1,
            select: { status: true, dueDate: true, amountCents: true },
          },
        },
      }),
      prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.order.groupBy({
        by: ["tenantId"],
        where: { createdAt: { gte: since }, status: { not: "cancelado" } },
        _sum: { subtotal_cents: true },
        _count: { _all: true },
      }),
    ]);

    const ordersBy = new Map(orders.map((o) => [o.tenantId, o] as const));
    const grace = graceDays();

    return NextResponse.json({
      ok: true,
      asaas: asaasConfigured(),
      plans,
      tenants: tenants.map((t) => {
        const o = ordersBy.get(t.id);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          active: t.active,
          status: t.status,
          state: billingState(t, new Date(), grace),
          trialEndsAt: t.trialEndsAt,
          suspendedReason: t.suspendedReason,
          hasSubscription: Boolean(t.asaasSubscriptionId),
          createdAt: t.createdAt,
          onboarded: Boolean(t.onboardedAt),
          plan: t.plan,
          stores: t.stores.length,
          monthlyCents: t.plan ? monthlyValueCents(t.plan.priceCents, t.stores.length) : null,
          owner: t.users[0] ?? null,
          domains: t.domains.map((d) => d.host),
          siteUrl: tenantSiteUrl(t.slug, t.domains.map((d) => d.host)),
          orders30: o?._count._all ?? 0,
          sales30Cents: o?._sum.subtotal_cents ?? 0,
          lastInvoice: t.invoices[0] ?? null,
        };
      }),
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/platform/tenants][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao listar as redes." }, { status: 500 });
  }
}

// Criar rede nova com o dono (ja pode entrar no painel).
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { tenant } = await createNetwork(body);
    return NextResponse.json({ ok: true, tenant }, { status: 201 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof NetworkInputError) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    }
    console.error("[api/admin/platform/tenants][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao criar a rede." }, { status: 500 });
  }
}
