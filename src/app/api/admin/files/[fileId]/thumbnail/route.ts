import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { getDriveClientForTenant, isDriveConfiguredForTenant } from '@/lib/drive/client';

// GET /api/admin/files/[fileId]/thumbnail
// Proxies the Google Drive thumbnail through our server (requires OAuth)
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const segments = req.nextUrl.pathname.split('/');
        const fileId = segments[segments.length - 2]; // /files/[fileId]/thumbnail

        const file = await prisma.file.findFirst({
            where: { id: fileId, tenantId: ctx.tenantId },
        });
        if (!file) return apiError('File not found', 404);
        if (!file.driveFileId || file.driveFileId.startsWith('mock_')) {
            return apiError('No Drive file', 404);
        }

        const configured = await isDriveConfiguredForTenant(ctx.tenantId);
        if (!configured) return apiError('Drive not configured', 400);

        try {
            const drive = await getDriveClientForTenant(ctx.tenantId);

            // Get thumbnail link from Drive API
            const meta = await drive.files.get({
                fileId: file.driveFileId,
                fields: 'thumbnailLink, mimeType',
            });

            const thumbnailLink = meta.data.thumbnailLink;
            const mimeType = meta.data.mimeType || '';

            // For images, get the actual file content as thumbnail
            if (mimeType.startsWith('image/')) {
                const imgRes = await drive.files.get(
                    { fileId: file.driveFileId, alt: 'media' },
                    { responseType: 'arraybuffer' }
                );
                return new NextResponse(imgRes.data as ArrayBuffer, {
                    headers: {
                        'Content-Type': mimeType,
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            }

            // For videos/docs, use the thumbnail from Google
            if (thumbnailLink) {
                const thumbRes = await fetch(thumbnailLink);
                const buffer = await thumbRes.arrayBuffer();
                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'public, max-age=3600',
                    },
                });
            }

            return apiError('No thumbnail available', 404);
        } catch (e) {
            console.error('Thumbnail proxy error:', e);
            return apiError('Failed to get thumbnail', 500);
        }
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
