-- AlterTable
ALTER TABLE "product_stores" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "manualClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedMessage" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "openingHours" JSONB,
    "deliveryTimeMinMinutes" INTEGER NOT NULL DEFAULT 30,
    "deliveryTimeMaxMinutes" INTEGER NOT NULL DEFAULT 45,
    "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 500,
    "freeDeliveryAboveCents" INTEGER,
    "whatsapp" TEXT,
    "paymentPix" BOOLEAN NOT NULL DEFAULT true,
    "paymentCash" BOOLEAN NOT NULL DEFAULT true,
    "paymentCredit" BOOLEAN NOT NULL DEFAULT false,
    "paymentDebit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_storeId_key" ON "store_settings"("storeId");

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
