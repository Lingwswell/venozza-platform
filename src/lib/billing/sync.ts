import { prisma } from "@/lib/db";
import {
  AsaasError,
  asaasConfigured,
  cancelSubscription,
  cleanDocument,
  createCustomer,
  createPayment,
  createSubscription,
  getPayment,
  invoiceStatusFromAsaas,
  isoDateSP,
  listSubscriptionPayments,
  updateSubscriptionValue,
  type AsaasPayment,
} from "@/lib/billing/asaas";
import { forgetBillingCache } from "@/lib/billing/server";
import { monthlyBreakdown } from "@/lib/billing/state";

// Liga a assinatura da rede ao Asaas e atualiza o status a partir das faturas.

export class BillingInputError extends Error {}

/** Grava (ou atualiza) a fatura vinda do Asaas. */
export async function upsertInvoiceFromPayment(
  tenantId: string,
  payment: AsaasPayment,
  kind: "subscription" | "one_off" = payment.subscription ? "subscription" : "one_off"
) {
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
    create: { ...data, tenantId, externalId: payment.id, kind },
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
    // Cobranca unica atrasada nao bloqueia a rede; so a mensalidade.
    prisma.invoice.findFirst({
      where: { tenantId, status: "overdue", kind: "subscription" },
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
  if (!asaasConfigured()) return;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { asaasSubscriptionId: true } });
  if (tenant?.asaasSubscriptionId) {
    const payments = await listSubscriptionPayments(tenant.asaasSubscriptionId);
    for (const payment of payments) await upsertInvoiceFromPayment(tenantId, payment, "subscription");
  }
  // Cobrancas unicas ainda em aberto.
  const openOneOffs = await prisma.invoice.findMany({
    where: { tenantId, kind: "one_off", status: { in: ["pending", "overdue"] }, externalId: { not: null } },
    select: { externalId: true },
    take: 20,
  });
  for (const inv of openOneOffs) {
    const payment = await getPayment(inv.externalId!).catch(() => null);
    if (payment) await upsertInvoiceFromPayment(tenantId, payment, "one_off");
  }
  await refreshTenantStatus(tenantId);
}

/**
 * Cobranca unica (implantacao, cadastro de cardapio...). Com Asaas e cliente cadastrado,
 * gera a fatura la (Pix/boleto/cartao); senao fica como fatura manual em aberto.
 */
export async function chargeOnce(tenantId: string, input: { amountCents: number; description: string; dueDate: Date }) {
  const amountCents = Math.round(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 500) throw new BillingInputError("Valor mínimo: R$ 5,00.");
  const description = input.description.trim().slice(0, 120) || "Cobrança avulsa";

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { asaasCustomerId: true } });
  if (asaasConfigured() && tenant?.asaasCustomerId) {
    const payment = await createPayment({
      customer: tenant.asaasCustomerId,
      valueCents: amountCents,
      dueDate: isoDateSP(input.dueDate),
      description,
      externalReference: tenantId,
    });
    await upsertInvoiceFromPayment(tenantId, { ...payment, description }, "one_off");
    return { viaAsaas: true };
  }

  await prisma.invoice.create({
    data: {
      tenantId,
      amountCents,
      status: "pending",
      dueDate: input.dueDate,
      billingType: "MANUAL",
      description,
      kind: "one_off",
    },
  });
  return { viaAsaas: false };
}

/** Valor do mes da rede: plano + lojas extras + adicionais contratados. */
export async function tenantMonthly(tenantId: string) {
  const [tenant, stores] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        plan: { select: { name: true, priceCents: true, maxStores: true, extraStorePriceCents: true } },
        addons: { select: { addon: { select: { name: true, priceCents: true, active: true } } } },
      },
    }),
    prisma.store.count({ where: { tenantId, active: true } }),
  ]);
  if (!tenant) return null;
  const addonsCents = tenant.addons.reduce((sum, a) => sum + (a.addon.active ? a.addon.priceCents : 0), 0);
  return {
    tenantName: tenant.name,
    plan: tenant.plan,
    stores,
    addons: tenant.addons.map((a) => a.addon.name),
    breakdown: tenant.plan ? monthlyBreakdown(tenant.plan, stores, addonsCents) : null,
  };
}

async function currentValue(tenantId: string) {
  const monthly = await tenantMonthly(tenantId);
  if (!monthly?.plan || !monthly.breakdown) throw new BillingInputError("Escolha um plano antes de ativar a cobrança.");
  const extras = [
    monthly.breakdown.extraStores ? `${monthly.breakdown.extraStores} loja(s) extra` : "",
    ...monthly.addons,
  ].filter(Boolean);
  return {
    valueCents: monthly.breakdown.totalCents,
    description: `${monthly.plan.name} — ${Math.max(monthly.stores, 1)} loja(s)${extras.length ? ` + ${extras.join(", ")}` : ""} — ${monthly.tenantName}`.slice(0, 250),
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
