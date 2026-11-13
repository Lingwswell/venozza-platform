import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { isNetworkRole, type Role } from "@/lib/auth/roles";
import { forgetBillingCache, graceDays } from "@/lib/billing/server";
import { billingState } from "@/lib/billing/state";
import { asaasConfigured } from "@/lib/billing/asaas";
import { activateSubscription, billingErrorMessage, pullInvoices, syncSubscriptionValue, tenantMonthly } from "@/lib/billing/sync";
import { forgetFeatures } from "@/lib/billing/features";

// Assinatura da propria rede (dono).

const lastPull = new Map<string, number>();

function ownerOnly(role: Role | null) {
  return isNetworkRole(role);
}

export async function GET(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!ownerOnly(scope.role)) {
      return NextResponse.json({ ok: false, error: "Só o dono da rede vê a assinatura." }, { status: 403 });
    }

    // Busca faturas no Asaas no maximo a cada 5 minutos (funciona sem webhook).
    if (asaasConfigured() && Date.now() - (lastPull.get(scope.tenantId) || 0) > 5 * 60 * 1000) {
      lastPull.set(scope.tenantId, Date.now());
      await pullInvoices(scope.tenantId).catch((error) => console.warn("[billing][pull]", error));
      await syncSubscriptionValue(scope.tenantId).catch((error) => console.warn("[billing][sync]", error));
    }

    const [tenant, plans, stores, invoices] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: scope.tenantId },
        select: {
          name: true,
          status: true,
          trialEndsAt: true,
          pastDueSince: true,
          asaasSubscriptionId: true,
          billingName: true,
          billingEmail: true,
          billingDocument: true,
          plan: {
            select: { id: true, name: true, priceCents: true, maxStores: true, extraStorePriceCents: true, description: true },
          },
          addons: { select: { addonId: true } },
        },
      }),
      prisma.plan.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, priceCents: true, maxStores: true, extraStorePriceCents: true, description: true },
      }),
      prisma.store.count({ where: { tenantId: scope.tenantId, active: true } }),
      prisma.invoice.findMany({
        where: { tenantId: scope.tenantId },
        orderBy: { dueDate: "desc" },
        take: 12,
        select: {
          id: true,
          amountCents: true,
          status: true,
          dueDate: true,
          paidAt: true,
          invoiceUrl: true,
          billingType: true,
          description: true,
          kind: true,
        },
      }),
    ]);
    const [monthly, addons] = await Promise.all([
      tenantMonthly(scope.tenantId),
      prisma.addon.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, description: true, priceCents: true, feature: true },
      }),
    ]);
    if (!tenant) return NextResponse.json({ ok: false, error: "Rede não encontrada." }, { status: 404 });

    const doc = tenant.billingDocument;
    return NextResponse.json({
      ok: true,
      name: tenant.name,
      state: billingState(tenant, new Date(), graceDays()),
      trialEndsAt: tenant.trialEndsAt,
      plan: tenant.plan,
      plans,
      stores,
      monthlyCents: monthly?.breakdown?.totalCents ?? null,
      breakdown: monthly?.breakdown ?? null,
      addons: addons.map((a) => ({ ...a, contracted: tenant.addons.some((t) => t.addonId === a.id) })),
      asaas: asaasConfigured(),
      hasSubscription: Boolean(tenant.asaasSubscriptionId),
      billing: {
        name: tenant.billingName,
        email: tenant.billingEmail,
        document: doc ? `${doc.slice(0, 3)}•••${doc.slice(-2)}` : null,
      },
      invoices,
    });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    console.error("[api/admin/billing][GET]", error);
    return NextResponse.json({ ok: false, error: "Erro ao carregar a assinatura." }, { status: 500 });
  }
}

// body.action: activate (nome, e-mail, CPF/CNPJ) | change_plan (planId)
export async function POST(req: Request) {
  try {
    const scope = await getAdminScope(req);
    if (!ownerOnly(scope.role)) {
      return NextResponse.json({ ok: false, error: "Só o dono da rede mexe na assinatura." }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "activate") {
      await activateSubscription(scope.tenantId, {
        name: String(body.name || ""),
        email: String(body.email || ""),
        document: body.document,
      });
      lastPull.delete(scope.tenantId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "change_plan") {
      const plan = await prisma.plan.findFirst({
        where: { id: String(body.planId || ""), active: true },
        select: { id: true, maxStores: true, extraStorePriceCents: true, name: true },
      });
      if (!plan) return NextResponse.json({ ok: false, error: "Plano inválido." }, { status: 400 });
      const stores = await prisma.store.count({ where: { tenantId: scope.tenantId, active: true } });
      if (plan.maxStores !== null && plan.extraStorePriceCents === null && stores > plan.maxStores) {
        return NextResponse.json(
          { ok: false, error: `O plano ${plan.name} vale para até ${plan.maxStores} loja(s). Você tem ${stores} ativas.` },
          { status: 400 }
        );
      }
      await prisma.tenant.update({ where: { id: scope.tenantId }, data: { planId: plan.id } });
      await syncSubscriptionValue(scope.tenantId);
      forgetBillingCache(scope.tenantId);
      return NextResponse.json({ ok: true });
    }

    // Contratar ou cancelar um adicional (soma na mensalidade).
    if (body.action === "toggle_addon") {
      const addon = await prisma.addon.findFirst({
        where: { id: String(body.addonId || ""), active: true },
        select: { id: true },
      });
      if (!addon) return NextResponse.json({ ok: false, error: "Adicional inválido." }, { status: 400 });
      if (body.enabled === true) {
        await prisma.tenantAddon.upsert({
          where: { tenantId_addonId: { tenantId: scope.tenantId, addonId: addon.id } },
          create: { tenantId: scope.tenantId, addonId: addon.id },
          update: {},
        });
      } else {
        await prisma.tenantAddon.deleteMany({ where: { tenantId: scope.tenantId, addonId: addon.id } });
      }
      forgetFeatures(scope.tenantId);
      await syncSubscriptionValue(scope.tenantId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    const billing = billingErrorMessage(error);
    if (billing) return NextResponse.json({ ok: false, error: billing }, { status: 400 });
    console.error("[api/admin/billing][POST]", error);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar a assinatura." }, { status: 500 });
  }
}
