# Schumaker Flow

## Migrations — histórico rebaseado em 2026-08-27

O histórico de migrations não batia com o schema real de produção (`Tenant` tinha 8 colunas — `featureFinance`, `evolutionInstance`, `maxProjects`, `maxUsers`, `plan`, `pixKey`, `pixKeyType`, `pixReceiverName` — que nenhuma migration criava, além de tabelas inteiras como `ClientAccess`, `ClientInstagram`, `Expense`, `PlanTemplate`, `ShareLink` e diferenças em `User`/`Project`/`DownloadEvent`, tudo aplicado em algum momento via `prisma db push` sem gerar migration).

Em 2026-08-27, `init`, `add_drive_oauth` e `add_briefings_module` foram substituídas por `prisma/migrations/20260827120000_baseline/`, gerada com `prisma migrate diff --from-empty --to-config-datasource --script` a partir de uma cópia restaurada de um dump verificado de produção. As três antigas foram movidas para `prisma/_migrations_archive/` (motivo documentado lá).

Confirmado com dois diffs vazios antes de fechar:
- `--from-migrations prisma/migrations --to-config-datasource` (histórico bate com o banco real)
- `--from-migrations prisma/migrations --to-schema prisma/schema.prisma` (histórico bate com o schema)

`prisma migrate dev` volta a ser seguro de usar normalmente — o histórico agora reflete a realidade.
