-- Camada SaaS: planos, assinatura da rede, faturas e eventos do webhook.
-- Redes existentes continuam "active", sem plano: nada muda para elas.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "planId" TEXT,
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "pastDueSince" TIMESTAMP(3),
ADD COLUMN "suspendedReason" TEXT,
ADD COLUMN "billingName" TEXT,
ADD COLUMN "billingEmail" TEXT,
ADD COLUMN "billingDocument" TEXT,
ADD COLUMN "asaasCustomerId" TEXT,
ADD COLUMN "asaasSubscriptionId" TEXT,
ADD COLUMN "billingValueCents" INTEGER,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "brandColor" TEXT,
ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "maxStores" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "externalId" TEXT,
    "invoiceUrl" TEXT,
    "billingType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_asaasSubscriptionId_key" ON "tenants"("asaasSubscriptionId");
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");
CREATE UNIQUE INDEX "invoices_externalId_key" ON "invoices"("externalId");
CREATE INDEX "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Planos iniciais (o super admin muda nome, valor e prazo no painel Redes > Planos).
INSERT INTO "plans" ("id", "name", "slug", "description", "priceCents", "trialDays", "maxStores", "active", "sortOrder", "updatedAt")
VALUES
  ('plan_essencial', 'Essencial', 'essencial', 'Site, app, KDS e pedidos para uma loja.', 14900, 14, 1, true, 10, CURRENT_TIMESTAMP),
  ('plan_rede', 'Rede', 'rede', 'Várias lojas, monitor, estoque com cozinha central e relatórios.', 24900, 14, NULL, true, 20, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
