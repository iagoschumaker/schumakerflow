import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(['DRAFT', 'IN_PRODUCTION', 'IN_REVIEW', 'DELIVERED', 'ARCHIVED']).optional(),
});

// GET /api/admin/projects/[projectId]
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const projectId = req.nextUrl.pathname.split('/').pop();

        const project = await prisma.project.findFirst({
            where: { id: projectId, tenantId: ctx.tenantId },
            include: {
                client: { select: { name: true } },
                files: {
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { downloadEvents: true } } },
                },
                _count: { select: { files: true } },
            },
        });
        if (!project) return apiError('Project not found', 404);

        // Convert BigInt sizeBytes to Number for JSON serialization
        const serialized = {
            ...project,
            files: project.files.map((f: any) => ({
                ...f,
                sizeBytes: Number(f.sizeBytes),
            })),
        };

        return apiSuccess(serialized);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// PUT /api/admin/projects/[projectId]
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const projectId = req.nextUrl.pathname.split('/').pop();

        const body = await req.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return apiError('Invalid input', 400);

        const existing = await prisma.project.findFirst({
            where: { id: projectId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('Project not found', 404);

        // Rename Drive folder if name changed
        if (parsed.data.name && parsed.data.name !== existing.name && existing.driveFolderId && !existing.driveFolderId.startsWith('mock_')) {
            try {
                const { getDriveClientForTenant, isDriveConfiguredForTenant } = await import('@/lib/drive/client');
                const configured = await isDriveConfiguredForTenant(ctx.tenantId);
                if (configured) {
                    const drive = await getDriveClientForTenant(ctx.tenantId);
                    await drive.files.update({
                        fileId: existing.driveFolderId,
                        requestBody: { name: parsed.data.name },
                    });
                }
            } catch (e) {
                console.error('Failed to rename Drive folder:', e);
            }
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: parsed.data as any,
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'project.update',
                entityType: 'Project',
                entityId: projectId!,
                details: JSON.stringify(parsed.data),
            },
        });

        return apiSuccess(project);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/projects/[projectId]
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const projectId = req.nextUrl.pathname.split('/').pop();

        const existing = await prisma.project.findFirst({
            where: { id: projectId, tenantId: ctx.tenantId },
            include: { files: { select: { id: true, driveFileId: true } } },
        });
        if (!existing) return apiError('Project not found', 404);

        // 1. Delete all files from Google Drive
        const { deleteFileFromDrive } = await import('@/lib/drive/files');
        for (const file of existing.files) {
            if (file.driveFileId && !file.driveFileId.startsWith('mock_')) {
                try {
                    await deleteFileFromDrive(ctx.tenantId, file.driveFileId);
                } catch (e) {
                    console.error(`Failed to delete Drive file ${file.driveFileId}:`, e);
                }
            }
        }

        // 2. Delete the project folder from Drive (this also removes subfolders)
        if (existing.driveFolderId && !existing.driveFolderId.startsWith('mock_')) {
            try {
                await deleteFileFromDrive(ctx.tenantId, existing.driveFolderId);
            } catch (e) {
                console.error(`Failed to delete Drive folder ${existing.driveFolderId}:`, e);
            }
        }

        // 3. Delete project from database (cascades to files, downloadEvents, etc.)
        await prisma.project.delete({ where: { id: projectId } });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'project.delete',
                entityType: 'Project',
                entityId: projectId!,
                details: JSON.stringify({ filesDeleted: existing.files.length }),
            },
        });

        return apiSuccess({ message: 'Project deleted' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
