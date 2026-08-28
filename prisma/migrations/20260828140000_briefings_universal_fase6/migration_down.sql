-- Migration DOWN — Reversal of briefings_universal_fase6
--
-- briefing_client_lists, the role column and the BriefingTemplateFieldRole
-- enum reverse cleanly (nothing else depends on them). The two new
-- BriefingTemplateFieldType values do NOT: PostgreSQL has no
-- "ALTER TYPE ... DROP VALUE" at all, ever (not a version gate like the
-- ADD VALUE-in-transaction restriction was) -- the only way to truly
-- remove them is to build a new enum type without those values and swap
-- every column over to it. That destroys any field currently typed
-- multi_select/client_list. This script refuses to do that silently: it
-- checks first, and raises instead of dropping data if any field (or, by
-- extension, any answer shaped for those types) is still using them.
-- Deactivate/migrate those fields by hand first if you really need this
-- enum fully clean, then rerun.

-- DropForeignKey / DropTable
DROP TABLE IF EXISTS "briefing_client_lists";

-- AlterTable
ALTER TABLE "briefing_template_fields" DROP COLUMN IF EXISTS "role";

-- DropEnum
DROP TYPE IF EXISTS "BriefingTemplateFieldRole";

-- BriefingTemplateFieldType: guarded refusal, see note above.
DO $$
DECLARE
    in_use INT;
BEGIN
    SELECT COUNT(*) INTO in_use
    FROM "briefing_template_fields"
    WHERE "type" IN ('multi_select', 'client_list');

    IF in_use > 0 THEN
        RAISE EXCEPTION 'Down migration stopped: % briefing_template_fields row(s) still use multi_select/client_list. Move them to another type first, then rerun this down migration.', in_use;
    END IF;

    -- No rows depend on the new values -- safe to rebuild the enum without them.
    CREATE TYPE "BriefingTemplateFieldType_old" AS ENUM (
        'text', 'textarea', 'date', 'month', 'time', 'money', 'number',
        'select', 'boolean', 'email', 'phone', 'url'
    );
    ALTER TABLE "briefing_template_fields"
        ALTER COLUMN "type" TYPE "BriefingTemplateFieldType_old"
        USING ("type"::text::"BriefingTemplateFieldType_old");
    DROP TYPE "BriefingTemplateFieldType";
    ALTER TYPE "BriefingTemplateFieldType_old" RENAME TO "BriefingTemplateFieldType";
END $$;
