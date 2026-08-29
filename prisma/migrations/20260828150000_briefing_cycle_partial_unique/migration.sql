-- Replaces the global unique constraint on briefing_cycles with a PARTIAL
-- unique index that only applies to non-archived rows. Bug: an archived
-- cycle (e.g. one the admin closed out) permanently occupied the
-- tenant+client+template+month slot, so creating a brand-new cycle for the
-- same slot failed with "já existe um briefing" even though the old one
-- was just history.

DROP INDEX "briefing_cycles_tenantId_clientId_templateId_referenceMonth_key";

CREATE UNIQUE INDEX "briefing_cycles_active_unique"
  ON "briefing_cycles" ("tenantId", "clientId", "templateId", "referenceMonth")
  WHERE "archivedAt" IS NULL;

CREATE INDEX "briefing_cycles_tenantId_clientId_templateId_referenceMonth_idx"
  ON "briefing_cycles" ("tenantId", "clientId", "templateId", "referenceMonth");
