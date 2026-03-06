import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { downloadFileFromDrive } from '@/lib/drive/files';

interface RouteParams {
    params: Promise<{ fileId: string }>;
}

/**
 * GET /api/files/[fileId]/stream
 * Inline streaming endpoint for previewing files (video, images, etc.)
 * Unlike /download, this uses inline Content-Disposition so browsers can render it.
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    const { fileId } = await params;

    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const file = await prisma.file.findUnique({
            where: { id: fileId },
            include: {
                project: {
                    include: { client: true },
                },
            },
        });

        if (!file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Validate tenant access
        if (session.role !== 'SUPERADMIN') {
            if (session.tenantId !== file.tenantId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // If client user, validate client access
        if (session.role === 'CLIENT_USER') {
            if (session.clientId !== file.project.client.id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (!file.isVisible) {
                return NextResponse.json({ error: 'File not available' }, { status: 403 });
            }
        }

        const driveFileId = file.driveFileId || `mock_file_${file.id}`;

        const { stream, metadata } = await downloadFileFromDrive(file.tenantId, driveFileId);

        return new NextResponse(stream, {
            headers: {
                'Content-Type': metadata.mimeType || 'application/octet-stream',
                'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
                ...(metadata.size > 0 ? { 'Content-Length': String(metadata.size) } : {}),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Stream endpoint error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
