-- Etapa 1: Product passa a pertencer ao Tenant (cozinha central)

-- 1. Renomear tabela
ALTER TABLE "Product" RENAME TO "products";

-- 2. Adicionar tenantId (nullable primeiro para não quebrar)
ALTER TABLE "products" ADD COLUMN "tenantId" TEXT;

-- 3. Preencher tenantId buscando via store atual
UPDATE "products" p
SET "tenantId" = s."tenantId"
FROM "stores" s
WHERE p."storeId" = s."id";

-- 4. Tornar NOT NULL (todos os registros já foram preenchidos)
ALTER TABLE "products" ALTER COLUMN "tenantId" SET NOT NULL;

-- 5. Remover storeId (vínculo produto<->loja fica em product_stores)
ALTER TABLE "products" DROP COLUMN "storeId";

-- 6. Adicionar updatedAt
ALTER TABLE "products" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 7. FK para tenants
ALTER TABLE "products"
  ADD CONSTRAINT "products_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Índices
CREATE INDEX "products_tenantId_idx" ON "products"("tenantId");
CREATE INDEX "products_available_idx" ON "products"("available");
