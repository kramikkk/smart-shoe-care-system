-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "transaction_deviceId_idx" ON "transaction"("deviceId");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "device"("deviceId") ON DELETE SET NULL ON UPDATE CASCADE;
