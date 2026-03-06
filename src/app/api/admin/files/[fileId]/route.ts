import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    kind: z.enum(['PREVIEW', 'FINAL', 'RAW', 'OTHER']).optional(),
    isVisible: z.boolean().optional(),
    publishedAt: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

// PUT /api/admin/files/[fileId]
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const fileId = req.nextUrl.pathname.split('/').pop();

        const body = await req.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return apiError('Invalid input', 400);

        const existing = await prisma.file.findFirst({
            where: { id: fileId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('File not found', 404);

        const data: Record<string, unknown> = { ...parsed.data };
        if (parsed.data.tags) data.tags = JSON.stringify(parsed.data.tags);
        if (parsed.data.isVisible === true && !existing.publishedAt) {
            data.publishedAt = new Date();
        }
        if (parsed.data.publishedAt) {
            data.publishedAt = new Date(parsed.data.publishedAt);
        }

        const file = await prisma.file.update({
            where: { id: fileId },
            data,
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'file.update',
                entityType: 'File',
                entityId: fileId!,
                details: JSON.stringify(parsed.data),
            },
        });

        return apiSuccess(file);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/files/[fileId]
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const fileId = req.nextUrl.pathname.split('/').pop();

        const existing = await prisma.file.findFirst({
            where: { id: fileId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('File not found', 404);

        // Delete from Google Drive if it has a real Drive file ID
        if (existing.driveFileId && !existing.driveFileId.startsWith('mock_')) {
            try {
                const { deleteFileFromDrive } = await import('@/lib/drive/files');
                await deleteFileFromDrive(ctx.tenantId, existing.driveFileId);
                console.log(`[Drive] Deleted file: ${existing.driveFileId}`);
            } catch (e) {
                console.error('[Drive] Failed to delete from Drive (continuing with DB delete):', e);
            }
        }

        await prisma.file.delete({ where: { id: fileId } });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'file.delete',
                entityType: 'File',
                entityId: fileId!,
                details: JSON.stringify({ name: existing.name, driveFileId: existing.driveFileId }),
            },
        });

        return apiSuccess({ message: 'File deleted' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
