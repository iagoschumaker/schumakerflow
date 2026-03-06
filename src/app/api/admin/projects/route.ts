import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { createProjectFolders, createClientFolders } from '@/lib/drive/folders';
import { z } from 'zod';

const createSchema = z.object({
    clientId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    status: z.enum(['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'CANCELLED']).optional(),
});

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'CANCELLED']).optional(),
});

// GET /api/admin/projects
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const clientId = req.nextUrl.searchParams.get('clientId');
        const status = req.nextUrl.searchParams.get('status');

        const where: Record<string, unknown> = { tenantId: ctx.tenantId };
        if (clientId) where.clientId = clientId;
        if (status) where.status = status;

        const projects = await prisma.project.findMany({
            where,
            include: {
                client: { select: { name: true } },
                _count: { select: { files: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return apiSuccess(projects);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// POST /api/admin/projects
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return apiError('Invalid input', 400);

        // Verify client belongs to tenant
        const client = await prisma.client.findFirst({
            where: { id: parsed.data.clientId, tenantId: ctx.tenantId },
        });
        if (!client) return apiError('Client not found', 404);

        // Create Drive folders (only if tenant has Drive configured and client has a folder)
        let driveFolderId: string | undefined;
        let drivePreviewFolderId: string | undefined;
        let driveFinalFolderId: string | undefined;
        let driveRawFolderId: string | undefined;
        let driveOtherFolderId: string | undefined;

        // Get tenant's Drive root folder
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { driveRootFolderId: true, driveRefreshToken: true },
        });

        const hasDriveConfigured = !!tenant?.driveRefreshToken && !!tenant?.driveRootFolderId;
        let clientFolderId = client.driveFolderId;

        // If Drive is configured but client doesn't have a folder (or has a mock one), create it
        if (hasDriveConfigured && (!clientFolderId || clientFolderId.startsWith('mock_'))) {
            try {
                const folder = await createClientFolders(ctx.tenantId, tenant!.driveRootFolderId!, client.name);
                clientFolderId = folder.folderId;
                // Update client with real folder ID
                await prisma.client.update({
                    where: { id: client.id },
                    data: { driveFolderId: clientFolderId },
                });
            } catch (e) {
                console.error('Failed to create Drive folder for client:', e);
            }
        }

        if (clientFolderId && !clientFolderId.startsWith('mock_')) {
            try {
                const folders = await createProjectFolders(ctx.tenantId, clientFolderId, parsed.data.name);
                driveFolderId = folders.projectFolder.folderId;
                drivePreviewFolderId = folders.previewFolder.folderId;
                driveFinalFolderId = folders.finalFolder.folderId;
                driveRawFolderId = folders.rawFolder.folderId;
                driveOtherFolderId = folders.otherFolder.folderId;
            } catch (e) {
                console.error('Failed to create Drive folders for project:', e);
            }
        }

        const project = await prisma.project.create({
            data: {
                tenantId: ctx.tenantId,
                clientId: parsed.data.clientId,
                name: parsed.data.name,
                description: parsed.data.description,
                status: (parsed.data.status || 'DRAFT') as any,
                driveFolderId,
                drivePreviewFolderId,
                driveFinalFolderId,
                driveRawFolderId,
                driveOtherFolderId,
            },
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'project.create',
                entityType: 'Project',
                entityId: project.id,
                details: JSON.stringify({ name: parsed.data.name }),
            },
        });

        return apiSuccess(project, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
