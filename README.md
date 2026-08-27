This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Migrations

Em 2026-08-27 o histórico de migrations foi rebaseado: `init`, `add_drive_oauth` e `add_briefings_module` (que não batiam mais com o schema real de produção, aplicado em parte via `prisma db push` sem gerar migration) foram substituídas por uma única `20260827120000_baseline`, gerada a partir de um dump verificado de produção. As antigas ficam arquivadas em `prisma/_migrations_archive/` só como registro histórico. Ver `CLAUDE.md` para detalhes.

## Módulo Briefings

Duas variáveis controlam o módulo:

- `NEXT_PUBLIC_BRIEFINGS_ENABLED` — build-time, client. Só mostra/esconde o item de menu. Mudar no `.env` da VPS exige rebuild (`npm run build`), reiniciar o processo não basta.
- `BRIEFINGS_ENABLED` — runtime, server. É a segurança de verdade: com `false`, `/admin/briefings/*` e `/api/admin/briefings*` retornam 404, e `/b/[token]` retorna 503.

**Mantenha `NEXT_PUBLIC_BRIEFINGS_ENABLED=false` em produção até a Fase 4 estar pronta.** O item de menu aponta para `/admin/briefings`, e a página de listagem (Fase 4) ainda não existe — ligar a flag antes disso faz o menu levar a um 404.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
