-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_tenantId_fkey";

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "addressComplement" TEXT,
ADD COLUMN     "addressNeighborhood" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "deliveryBaseFeeCents" INTEGER,
ADD COLUMN     "deliveryKmFeeCents" INTEGER,
ADD COLUMN     "deliveryRadiusKm" DECIMAL(65,30),
ADD COLUMN     "latitude" DECIMAL(65,30),
ADD COLUMN     "longitude" DECIMAL(65,30),
ADD COLUMN     "zipCode" TEXT;

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "products";

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "showInMobile" BOOLEAN NOT NULL DEFAULT true,
    "showInSite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL,
    "customizationType" TEXT NOT NULL DEFAULT 'auto',
    "description" TEXT,
    "image" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stores" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "price_cents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'generic',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "option_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_option_groups" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_option_availabilities" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "optionItemId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "price_cents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_option_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "subtotal_cents" INTEGER NOT NULL,
    "freight_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "note" TEXT,
    "size" TEXT,
    "crust" TEXT,
    "addons_json" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_tenantId_idx" ON "categories"("tenantId");

-- CreateIndex
CREATE INDEX "categories_active_idx" ON "categories"("active");

-- CreateIndex
CREATE INDEX "categories_sortOrder_idx" ON "categories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenantId_slug_key" ON "categories"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "product_stores_productId_idx" ON "product_stores"("productId");

-- CreateIndex
CREATE INDEX "product_stores_storeId_idx" ON "product_stores"("storeId");

-- CreateIndex
CREATE INDEX "product_stores_available_idx" ON "product_stores"("available");

-- CreateIndex
CREATE UNIQUE INDEX "product_stores_productId_storeId_key" ON "product_stores"("productId", "storeId");

-- CreateIndex
CREATE INDEX "option_groups_tenantId_idx" ON "option_groups"("tenantId");

-- CreateIndex
CREATE INDEX "option_groups_active_idx" ON "option_groups"("active");

-- CreateIndex
CREATE INDEX "option_groups_sortOrder_idx" ON "option_groups"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "option_groups_tenantId_slug_key" ON "option_groups"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "option_items_tenantId_idx" ON "option_items"("tenantId");

-- CreateIndex
CREATE INDEX "option_items_optionGroupId_idx" ON "option_items"("optionGroupId");

-- CreateIndex
CREATE INDEX "option_items_active_idx" ON "option_items"("active");

-- CreateIndex
CREATE INDEX "option_items_sortOrder_idx" ON "option_items"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "option_items_optionGroupId_slug_key" ON "option_items"("optionGroupId", "slug");

-- CreateIndex
CREATE INDEX "product_option_groups_productId_idx" ON "product_option_groups"("productId");

-- CreateIndex
CREATE INDEX "product_option_groups_optionGroupId_idx" ON "product_option_groups"("optionGroupId");

-- CreateIndex
CREATE INDEX "product_option_groups_active_idx" ON "product_option_groups"("active");

-- CreateIndex
CREATE INDEX "product_option_groups_sortOrder_idx" ON "product_option_groups"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_groups_productId_optionGroupId_key" ON "product_option_groups"("productId", "optionGroupId");

-- CreateIndex
CREATE INDEX "category_option_groups_categoryId_idx" ON "category_option_groups"("categoryId");

-- CreateIndex
CREATE INDEX "category_option_groups_optionGroupId_idx" ON "category_option_groups"("optionGroupId");

-- CreateIndex
CREATE INDEX "category_option_groups_active_idx" ON "category_option_groups"("active");

-- CreateIndex
CREATE INDEX "category_option_groups_sortOrder_idx" ON "category_option_groups"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "category_option_groups_categoryId_optionGroupId_key" ON "category_option_groups"("categoryId", "optionGroupId");

-- CreateIndex
CREATE INDEX "store_option_availabilities_storeId_idx" ON "store_option_availabilities"("storeId");

-- CreateIndex
CREATE INDEX "store_option_availabilities_optionItemId_idx" ON "store_option_availabilities"("optionItemId");

-- CreateIndex
CREATE INDEX "store_option_availabilities_available_idx" ON "store_option_availabilities"("available");

-- CreateIndex
CREATE UNIQUE INDEX "store_option_availabilities_storeId_optionItemId_key" ON "store_option_availabilities"("storeId", "optionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderCode_key" ON "orders"("orderCode");

-- CreateIndex
CREATE INDEX "orders_tenantId_idx" ON "orders"("tenantId");

-- CreateIndex
CREATE INDEX "orders_storeId_idx" ON "orders"("storeId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stores" ADD CONSTRAINT "product_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_items" ADD CONSTRAINT "option_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_items" ADD CONSTRAINT "option_items_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_option_groups" ADD CONSTRAINT "category_option_groups_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_option_groups" ADD CONSTRAINT "category_option_groups_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_option_availabilities" ADD CONSTRAINT "store_option_availabilities_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_option_availabilities" ADD CONSTRAINT "store_option_availabilities_optionItemId_fkey" FOREIGN KEY ("optionItemId") REFERENCES "option_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
