import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { getDriveClientForTenant, isDriveConfiguredForTenant } from '@/lib/drive/client';

// POST /api/admin/files/sync
// Checks all files for this tenant against Google Drive and removes orphaned records
export const POST = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const configured = await isDriveConfiguredForTenant(ctx.tenantId);
        if (!configured) return apiError('Drive not configured for this tenant', 400);

        const files = await prisma.file.findMany({
            where: { tenantId: ctx.tenantId },
            select: { id: true, name: true, driveFileId: true },
        });

        const drive = await getDriveClientForTenant(ctx.tenantId);
        const removed: string[] = [];
        const synced: string[] = [];

        for (const file of files) {
            if (!file.driveFileId || file.driveFileId.startsWith('mock_')) {
                synced.push(file.name);
                continue;
            }

            try {
                await drive.files.get({
                    fileId: file.driveFileId,
                    fields: 'id, trashed',
                });
                synced.push(file.name);
            } catch (e: unknown) {
                const status = (e as { code?: number })?.code;
                if (status === 404) {
                    // File was deleted from Drive — remove from DB
                    await prisma.file.delete({ where: { id: file.id } });
                    await prisma.auditLog.create({
                        data: {
                            tenantId: ctx.tenantId,
                            userId: ctx.session.userId,
                            action: 'file.sync_deleted',
                            entityType: 'File',
                            entityId: file.id,
                            details: JSON.stringify({ name: file.name, reason: 'Deleted from Google Drive' }),
                        },
                    });
                    removed.push(file.name);
                } else {
                    // Other error — skip
                    synced.push(file.name);
                }
            }
        }

        return apiSuccess({
            message: `Sincronização concluída. ${removed.length} arquivo(s) removido(s).`,
            removed,
            total: files.length,
            synced: synced.length,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
