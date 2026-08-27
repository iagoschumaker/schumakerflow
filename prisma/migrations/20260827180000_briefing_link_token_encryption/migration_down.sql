-- Migration DOWN — Reversal of briefing_link_token_encryption
--
-- NOT a full data restore: tokenHash values and the deleted
-- mes_referencia field row are gone by design (see migration.sql).
-- This only reverses the schema shape, structurally symmetric with up.

-- DropIndex
DROP INDEX IF EXISTS "briefing_links_tokenLookup_key";
DROP INDEX IF EXISTS "briefing_links_tokenLookup_idx";

-- AlterTable
ALTER TABLE "briefing_links" ADD COLUMN "tokenHash" TEXT;
UPDATE "briefing_links" SET "tokenHash" = 'unrecoverable-' || "id" WHERE "tokenHash" IS NULL;
ALTER TABLE "briefing_links" ALTER COLUMN "tokenHash" SET NOT NULL;

CREATE INDEX "briefing_links_tokenHash_idx" ON "briefing_links"("tokenHash" ASC);
CREATE UNIQUE INDEX "briefing_links_tokenHash_key" ON "briefing_links"("tokenHash" ASC);

ALTER TABLE "briefing_links" DROP COLUMN IF EXISTS "tokenLookup";
ALTER TABLE "briefing_links" DROP COLUMN IF EXISTS "tokenEnc";

-- AlterTable
ALTER TABLE "briefing_cycles" DROP COLUMN IF EXISTS "archivedAt";
