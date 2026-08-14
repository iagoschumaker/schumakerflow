-- CreateEnum
CREATE TYPE "BriefingTemplateSectionKind" AS ENUM ('single', 'repeater');

-- CreateEnum
CREATE TYPE "BriefingTemplateFieldType" AS ENUM ('text', 'textarea', 'date', 'month', 'time', 'money', 'number', 'select', 'boolean', 'email', 'phone', 'url');

-- CreateEnum
CREATE TYPE "BriefingTemplateFieldWidth" AS ENUM ('half', 'full');

-- CreateEnum
CREATE TYPE "BriefingCycleStatus" AS ENUM ('draft', 'sent', 'in_progress', 'submitted', 'archived');

-- CreateTable
CREATE TABLE "briefing_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "BriefingTemplateSectionKind" NOT NULL,
    "repeaterItemLabel" TEXT,
    "minItems" INTEGER,
    "maxItems" INTEGER,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "briefing_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_template_fields" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hint" TEXT,
    "placeholder" TEXT,
    "type" "BriefingTemplateFieldType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "width" "BriefingTemplateFieldWidth" NOT NULL DEFAULT 'half',
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "briefing_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_cycles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "title" TEXT,
    "status" "BriefingCycleStatus" NOT NULL DEFAULT 'draft',
    "dueDate" DATE,
    "submittedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_links" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "opensCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "briefing_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_answers" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "groupIndex" INTEGER NOT NULL DEFAULT 0,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_events" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "briefing_templates_tenantId_idx" ON "briefing_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_templates_tenantId_slug_key" ON "briefing_templates"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "briefing_template_sections_templateId_idx" ON "briefing_template_sections"("templateId");

-- CreateIndex
CREATE INDEX "briefing_template_fields_sectionId_idx" ON "briefing_template_fields"("sectionId");

-- CreateIndex
CREATE INDEX "briefing_cycles_tenantId_status_idx" ON "briefing_cycles"("tenantId", "status");

-- CreateIndex
CREATE INDEX "briefing_cycles_tenantId_referenceMonth_idx" ON "briefing_cycles"("tenantId", "referenceMonth");

-- CreateIndex
CREATE INDEX "briefing_cycles_clientId_idx" ON "briefing_cycles"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_cycles_tenantId_clientId_templateId_referenceMonth_key" ON "briefing_cycles"("tenantId", "clientId", "templateId", "referenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_links_tokenHash_key" ON "briefing_links"("tokenHash");

-- CreateIndex
CREATE INDEX "briefing_links_tokenHash_idx" ON "briefing_links"("tokenHash");

-- CreateIndex
CREATE INDEX "briefing_links_cycleId_idx" ON "briefing_links"("cycleId");

-- CreateIndex
CREATE INDEX "briefing_answers_cycleId_idx" ON "briefing_answers"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_answers_cycleId_fieldId_groupIndex_key" ON "briefing_answers"("cycleId", "fieldId", "groupIndex");

-- CreateIndex
CREATE INDEX "briefing_events_cycleId_idx" ON "briefing_events"("cycleId");

-- AddForeignKey
ALTER TABLE "briefing_templates" ADD CONSTRAINT "briefing_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_template_sections" ADD CONSTRAINT "briefing_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "briefing_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_template_fields" ADD CONSTRAINT "briefing_template_fields_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "briefing_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_cycles" ADD CONSTRAINT "briefing_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_cycles" ADD CONSTRAINT "briefing_cycles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_cycles" ADD CONSTRAINT "briefing_cycles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "briefing_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_links" ADD CONSTRAINT "briefing_links_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "briefing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_answers" ADD CONSTRAINT "briefing_answers_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "briefing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_answers" ADD CONSTRAINT "briefing_answers_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "briefing_template_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_events" ADD CONSTRAINT "briefing_events_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "briefing_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
