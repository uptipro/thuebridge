-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOSING_LEADS', 'DELAYING_FOLLOWUPS', 'JUST_ANNOYING');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "userInfo" JSONB,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactLevel" "ImpactLevel" NOT NULL,
    "metadataJson" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_apiKey_key" ON "Application"("apiKey");

-- CreateIndex
CREATE INDEX "FeedbackReport_appId_idx" ON "FeedbackReport"("appId");

-- CreateIndex
CREATE INDEX "FeedbackReport_status_idx" ON "FeedbackReport"("status");

-- CreateIndex
CREATE INDEX "FeedbackReport_impactLevel_idx" ON "FeedbackReport"("impactLevel");

-- CreateIndex
CREATE INDEX "FeedbackReport_createdAt_idx" ON "FeedbackReport"("createdAt");

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_appId_fkey" FOREIGN KEY ("appId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
