import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import type { AsaasPayment } from "@/lib/billing/asaas";
import { refreshTenantStatus, upsertInvoiceFromPayment } from "@/lib/billing/sync";

// Webhook do Asaas (Integracoes > Webhooks, eventos de cobranca).
// Precisa de ASAAS_WEBHOOK_TOKEN igual ao "token de autenticacao" configurado no Asaas.

function sameToken(received: string, expected: string) {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = String(process.env.ASAAS_WEBHOOK_TOKEN || "").trim();
  if (!expected) return NextResponse.json({ ok: false }, { status: 503 });
  if (!sameToken(req.headers.get("asaas-access-token") || "", expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      id?: string;
      event?: string;
      payment?: AsaasPayment & { externalReference?: string | null };
    } | null;
    if (!body?.event) return NextResponse.json({ ok: true });

    // Mesmo evento duas vezes: ignora.
    if (body.id) {
      const seen = await prisma.billingEvent.findUnique({ where: { id: body.id }, select: { id: true } });
      if (seen) return NextResponse.json({ ok: true, duplicate: true });
    }

    const payment = body.payment;
    if (body.event.startsWith("PAYMENT_") && payment?.id) {
      const tenant = payment.subscription
        ? await prisma.tenant.findUnique({ where: { asaasSubscriptionId: payment.subscription }, select: { id: true } })
        : payment.externalReference
          ? await prisma.tenant.findUnique({ where: { id: payment.externalReference }, select: { id: true } })
          : null;

      if (tenant) {
        const fixed = body.event === "PAYMENT_DELETED" ? { ...payment, status: "DELETED" } : payment;
        await upsertInvoiceFromPayment(tenant.id, fixed);
        await refreshTenantStatus(tenant.id);
      }
    }

    if (body.id) {
      await prisma.billingEvent.create({ data: { id: body.id, event: body.event } }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/billing/asaas/webhook]", error);
    // 500 faz o Asaas tentar de novo.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
