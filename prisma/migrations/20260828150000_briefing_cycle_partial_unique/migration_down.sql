-- Reverts to the global unique constraint. Will fail if two rows for the
-- same tenant+client+template+month now exist with different archivedAt
-- states -- that is expected: it means the partial index already did its
-- job and going back would silently reintroduce the bug. Resolve by hand
-- (archive/delete one of the conflicting rows) before reapplying.

DROP INDEX "briefing_cycles_tenantId_clientId_templateId_referenceMonth_idx";
DROP INDEX "briefing_cycles_active_unique";

ALTER TABLE "briefing_cycles"
  ADD CONSTRAINT "briefing_cycles_tenantId_clientId_templateId_referenceMonth_key"
  UNIQUE ("tenantId", "clientId", "templateId", "referenceMonth");
