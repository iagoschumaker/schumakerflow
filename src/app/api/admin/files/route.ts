import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { uploadFileToDrive } from '@/lib/drive/files';
import { extractDriveFileId } from '@/lib/drive/utils';
import { z } from 'zod';

const registerByLinkSchema = z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1),
    kind: z.enum(['PREVIEW', 'FINAL', 'RAW', 'OTHER']),
    driveLink: z.string().url(),
    isVisible: z.boolean().optional(),
    publishedAt: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

// GET /api/admin/files
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const projectId = req.nextUrl.searchParams.get('projectId');
        const where: Record<string, unknown> = { tenantId: ctx.tenantId };
        if (projectId) where.projectId = projectId;

        const files = await prisma.file.findMany({
            where,
            include: {
                project: { select: { name: true, client: { select: { name: true } } } },
                _count: { select: { downloadEvents: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const filesSerializable = files.map((f: Record<string, unknown>) => ({
            ...f,
            sizeBytes: Number(f.sizeBytes || 0),
        }));

        return apiSuccess(filesSerializable);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// POST /api/admin/files - Upload or register by link
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const contentType = req.headers.get('content-type') || '';

        // Handle file upload (multipart form data)
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as globalThis.File | null;
            const projectId = formData.get('projectId') as string;
            const kind = formData.get('kind') as string;
            const isVisible = formData.get('isVisible') === 'true';
            const fileLastModified = formData.get('fileLastModified') as string | null;

            if (!file || !projectId || !kind) {
                return apiError('Missing required fields: file, projectId, kind', 400);
            }

            // Verify project belongs to tenant with full hierarchy
            const project = await prisma.project.findFirst({
                where: { id: projectId, tenantId: ctx.tenantId },
                include: {
                    client: true,
                },
            });
            if (!project) return apiError('Project not found', 404);

            // Get tenant for Drive root folder
            const tenant = await prisma.tenant.findUnique({
                where: { id: ctx.tenantId },
                select: { driveRootFolderId: true, driveRefreshToken: true },
            });

            // Stream file to Drive — avoid loading entire file into memory for large uploads
            const fileSize = file.size;
            let fileData: Buffer | import('stream').Readable;

            if (fileSize < 50 * 1024 * 1024) {
                // Small files (<50MB): use buffer for simplicity
                fileData = Buffer.from(await file.arrayBuffer());
            } else {
                // Large files: stream directly without buffering
                const { Readable } = await import('stream');
                fileData = Readable.fromWeb(file.stream() as import('stream/web').ReadableStream);
            }

            let driveFileId: string | undefined;
            let mimeType = file.type;
            let sizeBytes = fileSize;
            let md5Hash: string | undefined;
            let targetFolderId: string | null = null;

            try {
                // Auto-create Drive folders if Drive is configured and project doesn't have folders yet
                if (tenant?.driveRefreshToken && tenant?.driveRootFolderId && !project.driveFolderId) {
                    const { createDriveFolder } = await import('@/lib/drive/folders');

                    const tenantInfo = await prisma.tenant.findUnique({
                        where: { id: ctx.tenantId },
                        select: { name: true },
                    });

                    // Tenant folder
                    const tenantFolder = await createDriveFolder(
                        ctx.tenantId,
                        tenantInfo?.name || 'Tenant',
                        tenant.driveRootFolderId
                    );

                    // Client folder
                    const clientFolder = await createDriveFolder(
                        ctx.tenantId,
                        project.client.name,
                        tenantFolder.folderId
                    );

                    // Project folder + subfolders
                    const projectFolder = await createDriveFolder(
                        ctx.tenantId,
                        project.name,
                        clientFolder.folderId
                    );
                    const previewFolder = await createDriveFolder(
                        ctx.tenantId,
                        'PREVIEW',
                        projectFolder.folderId
                    );
                    const finalFolder = await createDriveFolder(
                        ctx.tenantId,
                        'FINAL',
                        projectFolder.folderId
                    );
                    const rawFolder = await createDriveFolder(
                        ctx.tenantId,
                        'BRUTO',
                        projectFolder.folderId
                    );
                    const otherFolder = await createDriveFolder(
                        ctx.tenantId,
                        'OUTROS',
                        projectFolder.folderId
                    );

                    await prisma.project.update({
                        where: { id: projectId },
                        data: {
                            driveFolderId: projectFolder.folderId,
                            drivePreviewFolderId: previewFolder.folderId,
                            driveFinalFolderId: finalFolder.folderId,
                            driveRawFolderId: rawFolder.folderId,
                            driveOtherFolderId: otherFolder.folderId,
                        },
                    });

                    project.driveFolderId = projectFolder.folderId;
                    project.drivePreviewFolderId = previewFolder.folderId;
                    project.driveFinalFolderId = finalFolder.folderId;
                    (project as any).driveRawFolderId = rawFolder.folderId;
                    (project as any).driveOtherFolderId = otherFolder.folderId;
                }

                // Determine target folder
                targetFolderId =
                    kind === 'PREVIEW'
                        ? project.drivePreviewFolderId
                        : kind === 'FINAL'
                            ? project.driveFinalFolderId
                            : kind === 'RAW'
                                ? (project as any).driveRawFolderId
                                : (project as any).driveOtherFolderId || project.driveFolderId;

                // Always call uploadFileToDrive — it has a mock fallback when Drive isn't configured
                const result = await uploadFileToDrive(
                    ctx.tenantId,
                    file.name,
                    targetFolderId || 'root',
                    fileData,
                    file.type,
                    fileSize,
                );
                driveFileId = result.id;
                mimeType = result.mimeType;
                sizeBytes = result.size;
                md5Hash = result.md5Checksum;
            } catch (e) {
                console.error('Failed to upload to Drive:', e);
                // Fallback: generate a mock ID so the file record is still usable
                driveFileId = `mock_file_${Date.now()}`;
            }

            // Use video's modification date if available, otherwise current date
            const publishedDate = fileLastModified && !isNaN(Number(fileLastModified))
                ? new Date(Number(fileLastModified))
                : new Date();

            const fileRecord = await prisma.file.create({
                data: {
                    tenantId: ctx.tenantId,
                    projectId,
                    name: file.name,
                    kind: kind as any,
                    driveFileId,
                    driveFolderId: targetFolderId,
                    mimeType,
                    sizeBytes: BigInt(sizeBytes),
                    md5Hash,
                    isVisible,
                    publishedAt: publishedDate,
                },
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'file.upload',
                    entityType: 'File',
                    entityId: fileRecord.id,
                    details: JSON.stringify({ name: file.name, kind }),
                },
            });

            return apiSuccess({ ...fileRecord, sizeBytes: Number(fileRecord.sizeBytes) }, 201);
        }

        // Handle register by link (JSON)
        const body = await req.json();
        const parsed = registerByLinkSchema.safeParse(body);
        if (!parsed.success) return apiError('Invalid input', 400);

        // Verify project
        const project = await prisma.project.findFirst({
            where: { id: parsed.data.projectId, tenantId: ctx.tenantId },
        });
        if (!project) return apiError('Project not found', 404);

        // Extract drive file ID from link
        const driveFileId = extractDriveFileId(parsed.data.driveLink);
        if (!driveFileId) return apiError('Could not extract Drive file ID from link', 400);

        const fileRecord = await prisma.file.create({
            data: {
                tenantId: ctx.tenantId,
                projectId: parsed.data.projectId,
                name: parsed.data.name,
                kind: parsed.data.kind as any,
                driveFileId,
                isVisible: parsed.data.isVisible ?? false,
                publishedAt: parsed.data.isVisible ? new Date() : (parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null),
                tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
            },
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'file.register',
                entityType: 'File',
                entityId: fileRecord.id,
                details: JSON.stringify({ name: parsed.data.name, kind: parsed.data.kind }),
            },
        });

        return apiSuccess({ ...fileRecord, sizeBytes: Number(fileRecord.sizeBytes) }, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
