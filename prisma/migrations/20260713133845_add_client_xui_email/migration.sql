-- AlterTable
ALTER TABLE "Client" ADD COLUMN "xuiEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_xuiEmail_key" ON "Client"("xuiEmail");

