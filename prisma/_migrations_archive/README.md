# Migrations arquivadas — 2026-08-27

`20260305202455_init`, `20260305211115_add_drive_oauth` e `20260814144700_add_briefings_module` foram movidas para fora de `prisma/migrations/` nesta data.

## Motivo

O banco de produção nunca foi construído a partir dessas migrations — foi montado por `prisma db push` em algum momento anterior, sem gerar histórico. `init` e `add_drive_oauth` nunca apareceram em `_prisma_migrations` de produção, e o SQL delas descreve um schema que não bate com a realidade (ex.: `User.role` em vez de `User.isSuperAdmin`, tabelas `ClientUser`/`Company` que não existem, faltam `ClientAccess`, `ClientInstagram`, `Expense`, `PlanTemplate`, `ShareLink`, faltam 8 colunas em `Tenant`, entre outras diferenças).

Rodar essas migrations do zero produziria um schema errado e, contra um banco real, colide com objetos que já existem (foi isso que aconteceu ao tentar `migrate deploy` em produção: falhou em `CREATE TYPE "UserRole"`, que já existia).

`add_briefings_module` foi de fato aplicada em produção e registrada em `_prisma_migrations` — mas seu conteúdo já está incluído no baseline (que foi gerado a partir do banco real, pós-briefings), então mantê-la separada seria redundante.

## O que substitui essas três

`20260827120000_baseline/migration.sql` — gerado com `prisma migrate diff --from-empty --to-config-datasource --script` contra uma cópia restaurada do dump de produção verificado em 2026-08-27. Representa o schema real como ele é, incluindo tudo que essas três migrations deveriam ter criado.

Essas pastas continuam aqui só como registro histórico. Não movê-las de volta para `prisma/migrations/` — o Prisma leria e tentaria reaplicá-las.
