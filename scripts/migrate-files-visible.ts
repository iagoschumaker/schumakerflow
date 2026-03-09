/**
 * Migration script to update existing files:
 * 1. Set all files to isVisible = true
 * 2. Set publishedAt = createdAt for files that don't have publishedAt
 * 
 * Run: npx tsx scripts/migrate-files-visible.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🔄 Atualizando arquivos existentes...\n');

    // 1. Count files that need updating
    const hiddenFiles = await prisma.file.count({ where: { isVisible: false } });
    const noPublishedAt = await prisma.file.count({ where: { publishedAt: null } });

    console.log(`📊 Arquivos ocultos (isVisible: false): ${hiddenFiles}`);
    console.log(`📊 Arquivos sem publishedAt: ${noPublishedAt}`);

    // 2. Update all hidden files to visible
    if (hiddenFiles > 0) {
        const result1 = await prisma.file.updateMany({
            where: { isVisible: false },
            data: { isVisible: true },
        });
        console.log(`✅ ${result1.count} arquivo(s) marcados como visíveis`);
    }

    // 3. Set publishedAt = createdAt for files without publishedAt
    if (noPublishedAt > 0) {
        const filesWithoutDate = await prisma.file.findMany({
            where: { publishedAt: null },
            select: { id: true, createdAt: true },
        });

        for (const file of filesWithoutDate) {
            await prisma.file.update({
                where: { id: file.id },
                data: { publishedAt: file.createdAt },
            });
        }
        console.log(`✅ ${filesWithoutDate.length} arquivo(s) atualizados com publishedAt = createdAt`);
    }

    // 4. Summary
    const totalFiles = await prisma.file.count();
    const visibleFiles = await prisma.file.count({ where: { isVisible: true } });
    const withDate = await prisma.file.count({ where: { publishedAt: { not: null } } });

    console.log(`\n📋 Resumo final:`);
    console.log(`   Total de arquivos: ${totalFiles}`);
    console.log(`   Visíveis: ${visibleFiles}/${totalFiles}`);
    console.log(`   Com publishedAt: ${withDate}/${totalFiles}`);
    console.log('\n✅ Migração concluída!');
}

main()
    .catch((e) => {
        console.error('❌ Erro na migração:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
