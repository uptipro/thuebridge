-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleConditionalField" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleConditionalField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Module_appId_idx" ON "Module"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_appId_value_key" ON "Module"("appId", "value");

-- CreateIndex
CREATE INDEX "ModuleConditionalField_moduleId_idx" ON "ModuleConditionalField"("moduleId");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_appId_fkey" FOREIGN KEY ("appId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleConditionalField" ADD CONSTRAINT "ModuleConditionalField_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
