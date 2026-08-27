-- Migration DOWN — Reversal of add_briefings_module
-- Ordem: primeiro remove FKs, depois tabelas, depois enums

-- DropForeignKey
ALTER TABLE "briefing_events" DROP CONSTRAINT IF EXISTS "briefing_events_cycleId_fkey";
ALTER TABLE "briefing_answers" DROP CONSTRAINT IF EXISTS "briefing_answers_fieldId_fkey";
ALTER TABLE "briefing_answers" DROP CONSTRAINT IF EXISTS "briefing_answers_cycleId_fkey";
ALTER TABLE "briefing_links" DROP CONSTRAINT IF EXISTS "briefing_links_cycleId_fkey";
ALTER TABLE "briefing_cycles" DROP CONSTRAINT IF EXISTS "briefing_cycles_templateId_fkey";
ALTER TABLE "briefing_cycles" DROP CONSTRAINT IF EXISTS "briefing_cycles_clientId_fkey";
ALTER TABLE "briefing_cycles" DROP CONSTRAINT IF EXISTS "briefing_cycles_tenantId_fkey";
ALTER TABLE "briefing_template_fields" DROP CONSTRAINT IF EXISTS "briefing_template_fields_sectionId_fkey";
ALTER TABLE "briefing_template_sections" DROP CONSTRAINT IF EXISTS "briefing_template_sections_templateId_fkey";
ALTER TABLE "briefing_templates" DROP CONSTRAINT IF EXISTS "briefing_templates_tenantId_fkey";

-- DropTable
DROP TABLE IF EXISTS "briefing_events";
DROP TABLE IF EXISTS "briefing_answers";
DROP TABLE IF EXISTS "briefing_links";
DROP TABLE IF EXISTS "briefing_cycles";
DROP TABLE IF EXISTS "briefing_template_fields";
DROP TABLE IF EXISTS "briefing_template_sections";
DROP TABLE IF EXISTS "briefing_templates";

-- DropEnum
DROP TYPE IF EXISTS "BriefingCycleStatus";
DROP TYPE IF EXISTS "BriefingTemplateFieldWidth";
DROP TYPE IF EXISTS "BriefingTemplateFieldType";
DROP TYPE IF EXISTS "BriefingTemplateSectionKind";
