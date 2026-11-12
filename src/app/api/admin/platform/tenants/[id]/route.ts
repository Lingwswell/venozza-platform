import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminScope, scopeErrorResponse } from "@/lib/auth/scope";
import { assertPlatformAdmin, forgetBillingCache } from "@/lib/billing/server";
import { NetworkInputError, cleanHost } from "@/lib/billing/network";
import {
  billingErrorMessage,
  pullInvoices,
  refreshTenantStatus,
  stopSubscription,
  syncSubscriptionValue,
} from "@/lib/billing/sync";

// Acoes do administrador da plataforma sobre uma rede.
// body.action: suspend | reactivate | cancel | extend_trial | set_plan | add_domain | remove_domain
//              | mark_paid | sync | rename
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const scope = await getAdminScope(req);
    assertPlatformAdmin(scope);

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, status: true, trialEndsAt: true },
    });
    if (!tenant) return NextResponse.json({ ok: false, error: "Rede não encontrada." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "");

    if (id === scope.tenantId && (action === "suspend" || action === "cancel")) {
      return NextResponse.json({ ok: false, error: "Você não pode suspender a rede da própria plataforma." }, { status: 400 });
    }

    switch (action) {
      case "suspend": {
        const reason = body.reason === "inadimplencia" ? "inadimplencia" : String(body.reason || "manual").slice(0, 60);
        await prisma.tenant.update({ where: { id }, data: { status: "suspended", suspendedReason: reason } });
        break;
      }
      case "reactivate": {
        await prisma.tenant.update({
          where: { id },
          data: { status: "active", suspendedReason: null, pastDueSince: null, active: true },
        });
        break;
      }
      case "cancel": {
        await stopSubscription(id).catch((error) => console.warn("[platform][cancel][asaas]", error));
        await prisma.tenant.update({ where: { id }, data: { status: "canceled" } });
        break;
      }
      case "extend_trial": {
        const days = Math.round(Number(body.days));
        if (!Number.isFinite(days) || days < 1 || days > 180) {
          return NextResponse.json({ ok: false, error: "Informe de 1 a 180 dias." }, { status: 400 });
        }
        const start = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
        await prisma.tenant.update({
          where: { id },
          data: {
            status: "trial",
            trialEndsAt: new Date(start.getTime() + days * 24 * 60 * 60 * 1000),
            suspendedReason: null,
          },
        });
        break;
      }
      case "set_plan": {
        const planId = body.planId ? String(body.planId) : null;
        if (planId) {
          const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
          if (!plan) return NextResponse.json({ ok: false, error: "Plano inválido." }, { status: 400 });
        }
        await prisma.tenant.update({ where: { id }, data: { planId } });
        await syncSubscriptionValue(id);
        break;
      }
      case "add_domain": {
        const host = cleanHost(body.host);
        if (!host) return NextResponse.json({ ok: false, error: "Informe o domínio." }, { status: 400 });
        const used = await prisma.tenantDomain.findUnique({ where: { host }, select: { tenantId: true } });
        if (used && used.tenantId !== id) {
          return NextResponse.json({ ok: false, error: "Domínio já usado por outra rede." }, { status: 409 });
        }
        if (!used) await prisma.tenantDomain.create({ data: { tenantId: id, host } });
        break;
      }
      case "remove_domain": {
        const host = cleanHost(body.host);
        if (host) await prisma.tenantDomain.deleteMany({ where: { tenantId: id, host } });
        break;
      }
      case "mark_paid": {
        // Pagamento recebido fora do Asaas (Pix direto, dinheiro...).
        const amountCents = Math.round(Number(body.amountCents));
        if (!Number.isFinite(amountCents) || amountCents <= 0) {
          return NextResponse.json({ ok: false, error: "Informe o valor recebido." }, { status: 400 });
        }
        const months = Math.min(Math.max(Math.round(Number(body.months) || 1), 1), 24);
        await prisma.invoice.create({
          data: {
            tenantId: id,
            amountCents,
            status: "paid",
            dueDate: new Date(),
            paidAt: new Date(),
            billingType: "MANUAL",
            description: String(body.description || `Pagamento manual (${months} mês/meses)`).slice(0, 120),
          },
        });
        // Faturas vencidas que esse pagamento quita.
        await prisma.invoice.updateMany({
          where: { tenantId: id, status: "overdue", externalId: null },
          data: { status: "paid", paidAt: new Date() },
        });
        await prisma.tenant.update({
          where: { id },
          data: {
            status: "active",
            pastDueSince: null,
            suspendedReason: null,
            ...(tenant.status === "trial" ? { trialEndsAt: null } : {}),
          },
        });
        break;
      }
      case "sync": {
        await pullInvoices(id);
        await syncSubscriptionValue(id);
        await refreshTenantStatus(id);
        break;
      }
      case "rename": {
        const name = String(body.name || "").trim().slice(0, 80);
        if (name.length < 2) return NextResponse.json({ ok: false, error: "Nome inválido." }, { status: 400 });
        await prisma.tenant.update({ where: { id }, data: { name } });
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
    }

    forgetBillingCache(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const scoped = scopeErrorResponse(error);
    if (scoped) return scoped;
    if (error instanceof NetworkInputError) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
    }
    const billing = billingErrorMessage(error);
    if (billing) return NextResponse.json({ ok: false, error: billing }, { status: 400 });
    console.error("[api/admin/platform/tenants/:id][PATCH]", error);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar a rede." }, { status: 500 });
  }
}
