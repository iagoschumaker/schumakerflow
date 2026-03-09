/**
 * Backfill script: Update publishedAt for all files using the Drive modifiedTime.
 * 
 * Run: npx tsx scripts/backfill-published-dates.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { google } from 'googleapis';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🔄 Buscando datas reais dos arquivos no Google Drive...\n');

    // Get all tenants with Drive configured
    const tenants = await prisma.tenant.findMany({
        where: { driveRefreshToken: { not: null } },
        select: {
            id: true,
            name: true,
            driveRefreshToken: true,
            driveAccessToken: true,
            driveTokenExpiry: true,
        },
    });

    if (tenants.length === 0) {
        console.log('❌ Nenhum tenant com Drive configurado.');
        return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.log('❌ GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados.');
        return;
    }

    let totalUpdated = 0;

    for (const tenant of tenants) {
        console.log(`\n📂 Tenant: ${tenant.name}`);

        // Build Drive client
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({
            refresh_token: tenant.driveRefreshToken!,
            access_token: tenant.driveAccessToken || undefined,
            expiry_date: tenant.driveTokenExpiry ? tenant.driveTokenExpiry.getTime() : undefined,
        });

        // Refresh token
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);
        } catch (e) {
            console.error(`  ❌ Falha ao renovar token: ${e}`);
            continue;
        }

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Get all files with driveFileId
        const files = await prisma.file.findMany({
            where: { tenantId: tenant.id, driveFileId: { not: null } },
            select: { id: true, name: true, driveFileId: true, publishedAt: true },
        });

        console.log(`  📊 Total de arquivos: ${files.length}`);

        let updated = 0;
        for (const file of files) {
            if (!file.driveFileId) continue;

            try {
                const res = await drive.files.get({
                    fileId: file.driveFileId,
                    fields: 'modifiedTime, createdTime',
                });

                const driveDate = res.data.createdTime
                    ? new Date(res.data.createdTime)
                    : res.data.modifiedTime
                        ? new Date(res.data.modifiedTime)
                        : null;

                if (driveDate) {
                    await prisma.file.update({
                        where: { id: file.id },
                        data: {
                            publishedAt: driveDate,
                            isVisible: true,
                        },
                    });
                    updated++;
                    console.log(`  ✅ ${file.name} → ${driveDate.toLocaleDateString('pt-BR')}`);
                }
            } catch (e: unknown) {
                const code = (e as { code?: number })?.code;
                if (code === 404) {
                    console.log(`  ⚠️  ${file.name} — não encontrado no Drive (deletado?)`);
                } else {
                    console.error(`  ❌ ${file.name} — erro: ${e}`);
                }
            }
        }

        console.log(`  📋 ${updated} arquivo(s) atualizados`);
        totalUpdated += updated;
    }

    console.log(`\n✅ Backfill concluído! ${totalUpdated} arquivo(s) atualizados no total.`);
}

main()
    .catch((e) => {
        console.error('❌ Erro:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
