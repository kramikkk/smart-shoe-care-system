-- CreateIndex
CREATE INDEX "transaction_dateTime_idx" ON "transaction"("dateTime");

-- CreateIndex
CREATE INDEX "transaction_paymentMethod_idx" ON "transaction"("paymentMethod");

-- CreateIndex
CREATE INDEX "transaction_status_idx" ON "transaction"("status");
