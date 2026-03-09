import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { getDriveClientForTenant, isDriveConfiguredForTenant } from '@/lib/drive/client';

// POST /api/admin/files/sync
// Bidirectional sync:
// 1. Import new files from Drive folders into the database
// 2. Remove orphaned DB records (files deleted from Drive)
export const POST = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const configured = await isDriveConfiguredForTenant(ctx.tenantId);
        if (!configured) return apiError('Drive not configured for this tenant', 400);

        const drive = await getDriveClientForTenant(ctx.tenantId);

        // Get all projects with Drive folders
        const projects = await prisma.project.findMany({
            where: { tenantId: ctx.tenantId, driveFolderId: { not: null } },
            select: {
                id: true,
                name: true,
                driveFolderId: true,
                drivePreviewFolderId: true,
                driveFinalFolderId: true,
                driveRawFolderId: true,
                driveOtherFolderId: true,
            },
        });

        // Get all existing driveFileIds to avoid duplicates
        const existingFiles = await prisma.file.findMany({
            where: { tenantId: ctx.tenantId, driveFileId: { not: null } },
            select: { driveFileId: true },
        });
        const existingDriveIds = new Set(existingFiles.map(f => f.driveFileId));

        let imported = 0;
        let removed = 0;
        const importedNames: string[] = [];
        const removedNames: string[] = [];

        // --- PART 1: Import new files from Drive ---
        const folderKindMap: { key: string; kind: string }[] = [
            { key: 'drivePreviewFolderId', kind: 'PREVIEW' },
            { key: 'driveFinalFolderId', kind: 'FINAL' },
            { key: 'driveRawFolderId', kind: 'RAW' },
            { key: 'driveOtherFolderId', kind: 'OTHER' },
        ];

        for (const project of projects) {
            for (const { key, kind } of folderKindMap) {
                const folderId = (project as any)[key];
                if (!folderId || folderId.startsWith('mock_')) continue;

                try {
                    // List all files inside this Drive folder
                    let pageToken: string | undefined;
                    do {
                        const res = await drive.files.list({
                            q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
                            fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum, modifiedTime, createdTime)',
                            pageSize: 100,
                            pageToken,
                        });

                        for (const file of res.data.files || []) {
                            if (!file.id || existingDriveIds.has(file.id)) continue;

                            // Use the Drive file's modifiedTime as publishedAt
                            const fileDate = file.modifiedTime ? new Date(file.modifiedTime)
                                : file.createdTime ? new Date(file.createdTime) : new Date();

                            // This file exists in Drive but not in DB — import it
                            await prisma.file.create({
                                data: {
                                    tenantId: ctx.tenantId,
                                    projectId: project.id,
                                    name: file.name || 'Sem nome',
                                    kind: kind as any,
                                    driveFileId: file.id,
                                    driveFolderId: folderId,
                                    mimeType: file.mimeType || null,
                                    sizeBytes: file.size ? BigInt(file.size) : null,
                                    md5Hash: file.md5Checksum || null,
                                    isVisible: true,
                                    publishedAt: fileDate,
                                },
                            });

                            existingDriveIds.add(file.id);
                            importedNames.push(`${file.name} (${project.name}/${kind})`);
                            imported++;
                        }

                        pageToken = res.data.nextPageToken || undefined;
                    } while (pageToken);
                } catch (e) {
                    console.error(`Failed to list Drive folder ${folderId} for project ${project.name}:`, e);
                }
            }
        }

        // --- PART 2: Remove orphaned DB records ---
        const allFiles = await prisma.file.findMany({
            where: { tenantId: ctx.tenantId },
            select: { id: true, name: true, driveFileId: true },
        });

        for (const file of allFiles) {
            if (!file.driveFileId || file.driveFileId.startsWith('mock_')) continue;

            try {
                const res = await drive.files.get({
                    fileId: file.driveFileId,
                    fields: 'id, trashed',
                });
                if ((res.data as any).trashed) {
                    await prisma.file.delete({ where: { id: file.id } });
                    removedNames.push(file.name);
                    removed++;
                }
            } catch (e: unknown) {
                const status = (e as { code?: number })?.code;
                if (status === 404) {
                    await prisma.file.delete({ where: { id: file.id } });
                    removedNames.push(file.name);
                    removed++;
                }
            }
        }

        // Audit log
        if (imported > 0 || removed > 0) {
            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'files.sync',
                    entityType: 'File',
                    entityId: ctx.tenantId,
                    details: JSON.stringify({ imported, removed, importedNames, removedNames }),
                },
            });
        }

        return apiSuccess({
            message: `Sincronização concluída. ${imported} arquivo(s) importado(s), ${removed} removido(s).`,
            imported,
            removed,
            importedNames,
            removedNames,
            totalProjects: projects.length,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
