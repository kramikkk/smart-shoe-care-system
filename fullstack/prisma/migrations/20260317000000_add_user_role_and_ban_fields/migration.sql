-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'client');

-- AlterTable
ALTER TABLE "user"
  ADD COLUMN "role"      "user_role",
  ADD COLUMN "banned"    BOOLEAN,
  ADD COLUMN "banReason" TEXT,
  ADD COLUMN "banExpires" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
