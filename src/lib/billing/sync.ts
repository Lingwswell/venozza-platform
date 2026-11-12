import { prisma } from "@/lib/db";
import {
  AsaasError,
  asaasConfigured,
  cancelSubscription,
  cleanDocument,
  createCustomer,
  createSubscription,
  invoiceStatusFromAsaas,
  isoDateSP,
  listSubscriptionPayments,
  updateSubscriptionValue,
  type AsaasPayment,
} from "@/lib/billing/asaas";
import { forgetBillingCache } from "@/lib/billing/server";
import { monthlyValueCents } from "@/lib/billing/state";

// Liga a assinatura da rede ao Asaas e atualiza o status a partir das faturas.

export class BillingInputError extends Error {}

/** Grava (ou atualiza) a fatura vinda do Asaas. */
export async function upsertInvoiceFromPayment(tenantId: string, payment: AsaasPayment) {
  const status = invoiceStatusFromAsaas(payment.status);
  const paidDate = payment.clientPaymentDate || payment.paymentDate;
  const data = {
    amountCents: Math.round(Number(payment.value || 0) * 100),
    status,
    dueDate: new Date(`${payment.dueDate}T12:00:00-03:00`),
    paidAt: status === "paid" ? (paidDate ? new Date(`${paidDate}T12:00:00-03:00`) : new Date()) : null,
    invoiceUrl: payment.invoiceUrl || null,
    billingType: payment.billingType || null,
    description: payment.description || null,
  };
  await prisma.invoice.upsert({
    where: { externalId: payment.id },
    create: { ...data, tenantId, externalId: payment.id },
    update: data,
  });
}

/**
 * Status da rede a partir das faturas:
 * fatura vencida -> past_due (com a data da mais antiga); tudo pago -> active.
 * Suspensao manual do super admin (motivo diferente de inadimplencia) nao e mexida.
 */
export async function refreshTenantStatus(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, suspendedReason: true },
  });
  if (!tenant) return;
  if ((tenant.status === "suspended" && tenant.suspendedReason !== "inadimplencia") || tenant.status === "canceled") {
    return;
  }

  const [overdue, paid] = await Promise.all([
    prisma.invoice.findFirst({
      where: { tenantId, status: "overdue" },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true },
    }),
    prisma.invoice.count({ where: { tenantId, status: "paid" } }),
  ]);

  if (overdue) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "past_due", pastDueSince: overdue.dueDate },
    });
  } else if (tenant.status === "past_due" || tenant.status === "suspended" || (tenant.status === "trial" && paid > 0)) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "active", pastDueSince: null, suspendedReason: null },
    });
  }
  forgetBillingCache(tenantId);
}

/** Busca as faturas da assinatura no Asaas (funciona mesmo sem webhook). */
export async function pullInvoices(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { asaasSubscriptionId: true } });
  if (!tenant?.asaasSubscriptionId || !asaasConfigured()) return;
  const payments = await listSubscriptionPayments(tenant.asaasSubscriptionId);
  for (const payment of payments) await upsertInvoiceFromPayment(tenantId, payment);
  await refreshTenantStatus(tenantId);
}

async function currentValue(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, plan: { select: { name: true, priceCents: true } } },
  });
  if (!tenant?.plan) throw new BillingInputError("Escolha um plano antes de ativar a cobrança.");
  const stores = await prisma.store.count({ where: { tenantId, active: true } });
  return {
    valueCents: monthlyValueCents(tenant.plan.priceCents, stores),
    description: `${tenant.plan.name} — ${Math.max(stores, 1)} loja(s) — ${tenant.name}`,
  };
}

/** Cria cliente e assinatura no Asaas. A primeira fatura vence no fim do teste (ou amanha). */
export async function activateSubscription(
  tenantId: string,
  input: { name: string; email: string; document: unknown }
) {
  if (!asaasConfigured()) throw new BillingInputError("Cobrança automática ainda não configurada na plataforma.");
  const document = cleanDocument(input.document);
  if (!document) throw new BillingInputError("Informe um CPF ou CNPJ válido (só números).");
  const name = String(input.name || "").trim().slice(0, 100);
  if (!name) throw new BillingInputError("Informe o nome para a nota.");
  const email = String(input.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BillingInputError("Informe um e-mail válido.");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { asaasCustomerId: true, asaasSubscriptionId: true, trialEndsAt: true },
  });
  if (!tenant) throw new BillingInputError("Rede não encontrada.");
  if (tenant.asaasSubscriptionId) throw new BillingInputError("A cobrança desta rede já está ativa.");

  const { valueCents, description } = await currentValue(tenantId);

  const customerId =
    tenant.asaasCustomerId || (await createCustomer({ name, cpfCnpj: document, email, externalReference: tenantId }));

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const firstDue = tenant.trialEndsAt && tenant.trialEndsAt > tomorrow ? tenant.trialEndsAt : tomorrow;

  // Guarda o cliente antes: se a assinatura falhar, nao cria outro cliente na proxima tentativa.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { asaasCustomerId: customerId, billingName: name, billingEmail: email, billingDocument: document },
  });

  const subscriptionId = await createSubscription({
    customer: customerId,
    valueCents,
    nextDueDate: isoDateSP(firstDue),
    description,
    externalReference: tenantId,
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { asaasSubscriptionId: subscriptionId, billingValueCents: valueCents },
  });
  forgetBillingCache(tenantId);
  await pullInvoices(tenantId).catch((error) => console.warn("[billing][activate][pull]", error));
}

/** Plano ou numero de lojas mudou: atualiza o valor das proximas faturas. */
export async function syncSubscriptionValue(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { asaasSubscriptionId: true, billingValueCents: true, planId: true },
  });
  if (!tenant?.asaasSubscriptionId || !tenant.planId || !asaasConfigured()) return false;
  const { valueCents, description } = await currentValue(tenantId);
  if (tenant.billingValueCents === valueCents) return false;
  await updateSubscriptionValue(tenant.asaasSubscriptionId, valueCents, description);
  await prisma.tenant.update({ where: { id: tenantId }, data: { billingValueCents: valueCents } });
  return true;
}

export async function stopSubscription(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { asaasSubscriptionId: true } });
  if (tenant?.asaasSubscriptionId && asaasConfigured()) {
    await cancelSubscription(tenant.asaasSubscriptionId);
  }
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { asaasSubscriptionId: null, billingValueCents: null },
  });
}

export function billingErrorMessage(error: unknown) {
  if (error instanceof BillingInputError || error instanceof AsaasError) return (error as Error).message;
  return null;
}
