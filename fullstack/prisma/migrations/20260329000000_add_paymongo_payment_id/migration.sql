-- AlterTable
ALTER TABLE "transaction" ADD COLUMN "paymongoPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transaction_paymongoPaymentId_key" ON "transaction"("paymongoPaymentId");
