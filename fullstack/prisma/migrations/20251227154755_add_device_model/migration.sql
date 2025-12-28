-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "shoeType" TEXT NOT NULL,
    "careType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_pricing" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pairingCode" TEXT,
    "paired" BOOLEAN NOT NULL DEFAULT false,
    "pairedAt" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transactionId_key" ON "transaction"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "service_pricing_serviceType_key" ON "service_pricing"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "device_deviceId_key" ON "device"("deviceId");
