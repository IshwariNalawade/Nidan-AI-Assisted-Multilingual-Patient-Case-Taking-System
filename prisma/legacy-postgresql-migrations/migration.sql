ALTER TABLE "Assessment" ADD COLUMN "queueToken" TEXT;
CREATE UNIQUE INDEX "Assessment_queueToken_key" ON "Assessment"("queueToken");
