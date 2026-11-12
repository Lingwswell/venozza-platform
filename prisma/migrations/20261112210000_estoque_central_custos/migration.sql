-- Custo dos insumos e envio/recebimento do abastecimento.

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN "costCents" INTEGER;

-- AlterTable
ALTER TABLE "supply_requests" ADD COLUMN "receivedAt" TIMESTAMP(3),
ADD COLUMN "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "supply_request_items" ADD COLUMN "quantityReceived" DOUBLE PRECISION;
