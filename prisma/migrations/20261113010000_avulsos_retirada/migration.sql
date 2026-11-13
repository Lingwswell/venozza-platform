-- Retirada na loja, loja extra avulsa, recursos adicionais e cobranca unica.

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN "pickupEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'entrega';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN "extraStorePriceCents" INTEGER;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'subscription';

-- CreateTable
CREATE TABLE "addons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "feature" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_addons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "addons_slug_key" ON "addons"("slug");
CREATE UNIQUE INDEX "tenant_addons_tenantId_addonId_key" ON "tenant_addons"("tenantId", "addonId");

-- AddForeignKey
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
