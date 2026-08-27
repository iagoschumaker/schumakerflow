-- Migration DOWN — Reversal of add_briefings_field_soft_delete_meta
-- Ordem: primeiro remove o index, depois as colunas

-- DropIndex
DROP INDEX IF EXISTS "briefing_template_fields_sectionId_key_key";

-- AlterTable
ALTER TABLE "briefing_events" DROP COLUMN IF EXISTS "meta";

-- AlterTable
ALTER TABLE "briefing_template_fields" DROP COLUMN IF EXISTS "isActive";

-- AlterTable
ALTER TABLE "briefing_template_sections" DROP COLUMN IF EXISTS "emptyLabel";
