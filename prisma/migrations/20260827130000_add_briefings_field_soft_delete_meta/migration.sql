-- AlterTable
ALTER TABLE "briefing_template_sections" ADD COLUMN     "emptyLabel" TEXT;

-- AlterTable
ALTER TABLE "briefing_template_fields" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "briefing_events" ADD COLUMN     "meta" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "briefing_template_fields_sectionId_key_key" ON "briefing_template_fields"("sectionId", "key");
