/*
  Warnings:

  - The `transactionId` column on the `transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "transactionId",
ADD COLUMN     "transactionId" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transactionId_key" ON "transaction"("transactionId");
