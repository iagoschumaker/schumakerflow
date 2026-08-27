-- Links move from a one-way SHA-256 hash to recoverable AES-256-GCM
-- encryption (see src/lib/briefings/token.ts). tokenHash could only be
-- compared, never shown again; tokenEnc can be decrypted for "Mostrar
-- link" on the admin detail page. tokenLookup keeps the SHA-256 hash
-- of the plaintext token, used only for the public route's WHERE lookup.
--
-- Pre-existing links were hashed with the old scheme, so we cannot
-- decrypt them into tokenEnc after the fact -- there is no plaintext
-- to encrypt. They are revoked instead (data-integrity call from the
-- product owner: at migration time the only rows in this table belong
-- to a test cycle).

-- AlterTable
ALTER TABLE "briefing_cycles" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "briefing_links" ADD COLUMN "tokenEnc" TEXT;
ALTER TABLE "briefing_links" ADD COLUMN "tokenLookup" TEXT;

-- DataMigration: revoke links that predate encrypted tokens (no plaintext to encrypt)
UPDATE "briefing_links" SET "revokedAt" = COALESCE("revokedAt", now()) WHERE "tokenEnc" IS NULL;
UPDATE "briefing_links" SET "tokenEnc" = '', "tokenLookup" = 'legacy-revoked-' || "id" WHERE "tokenEnc" IS NULL;

-- AlterTable: now safe to enforce NOT NULL
ALTER TABLE "briefing_links" ALTER COLUMN "tokenEnc" SET NOT NULL;
ALTER TABLE "briefing_links" ALTER COLUMN "tokenLookup" SET NOT NULL;

-- DropIndex
DROP INDEX "briefing_links_tokenHash_idx";
DROP INDEX "briefing_links_tokenHash_key";

-- AlterTable
ALTER TABLE "briefing_links" DROP COLUMN "tokenHash";

-- CreateIndex
CREATE INDEX "briefing_links_tokenLookup_idx" ON "briefing_links"("tokenLookup" ASC);
CREATE UNIQUE INDEX "briefing_links_tokenLookup_key" ON "briefing_links"("tokenLookup" ASC);

-- DataMigration: drop the redundant "mês de referência" field from the
-- one seeded template -- the cycle already carries referenceMonth, so
-- asking the client to re-enter it duplicated data. Confirmed 0 rows in
-- briefing_answers reference this field before writing this migration.
DELETE FROM "briefing_template_fields" f
USING "briefing_template_sections" s, "briefing_templates" t
WHERE f."sectionId" = s."id"
  AND s."templateId" = t."id"
  AND t."slug" = 'social-media-mensal'
  AND f."key" = 'mes_referencia';
