-- Fase 6 — tornar o módulo de briefings genérico entre clientes/tenants.
--
-- - briefing_client_lists: listas nomeadas por cliente (unidades, áreas,
--   linhas de produto...) que um campo do tipo client_list pode referenciar
--   por "key", em vez do cliente digitar texto livre todo mês.
-- - Dois tipos de campo novos: multi_select (opções fixas do próprio campo)
--   e client_list (opções vêm de uma BriefingClientList do cliente).
-- - "role": papel semântico opcional (period_start, launch_date, scope...)
--   para as regras de CONFERIR raciocinarem sobre o que um campo significa
--   sem nunca depender da key/label de um campo específico.
--
-- PostgreSQL 14 em produção: múltiplos ADD VALUE na mesma transação são
-- seguros desde que os valores não sejam usados nesta mesma transação (só
-- é problema em PG <= 11, quando exigiria uma migration por valor). Não há
-- INSERT/UPDATE usando os valores novos aqui, então é seguro.

-- CreateEnum
CREATE TYPE "BriefingTemplateFieldRole" AS ENUM ('period_start', 'period_end', 'event_date', 'launch_date', 'production_date', 'scope', 'priority', 'needs_promotion', 'details');

-- AlterEnum
ALTER TYPE "BriefingTemplateFieldType" ADD VALUE 'multi_select';
ALTER TYPE "BriefingTemplateFieldType" ADD VALUE 'client_list';

-- AlterTable
ALTER TABLE "briefing_template_fields" ADD COLUMN     "role" "BriefingTemplateFieldRole";

-- CreateTable
CREATE TABLE "briefing_client_lists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_client_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "briefing_client_lists_tenantId_clientId_idx" ON "briefing_client_lists"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_client_lists_tenantId_clientId_key_key" ON "briefing_client_lists"("tenantId", "clientId", "key");

-- AddForeignKey
ALTER TABLE "briefing_client_lists" ADD CONSTRAINT "briefing_client_lists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_client_lists" ADD CONSTRAINT "briefing_client_lists_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
