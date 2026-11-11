-- Papeis padronizados: minusculas; "admin" antigo vira "owner" (dono da rede).
UPDATE "users" SET "role" = lower(trim("role"));
UPDATE "users" SET "role" = 'owner' WHERE "role" = 'admin';

-- CreateTable
CREATE TABLE "user_stores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_stores_userId_storeId_key" ON "user_stores"("userId", "storeId");

-- CreateIndex
CREATE INDEX "user_stores_storeId_idx" ON "user_stores"("storeId");

-- AddForeignKey
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem ja tinha loja principal passa a ter acesso a ela.
INSERT INTO "user_stores" ("id", "userId", "storeId")
SELECT 'us_' || md5(u."id" || u."storeId"), u."id", u."storeId"
FROM "users" u
WHERE u."storeId" IS NOT NULL
ON CONFLICT ("userId", "storeId") DO NOTHING;

-- Produto passa a pertencer a rede (tenant).
ALTER TABLE "Product" ADD COLUMN "tenantId" TEXT;

UPDATE "Product" p
SET "tenantId" = s."tenantId"
FROM "stores" s
WHERE s."id" = p."storeId" AND p."tenantId" IS NULL;

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
