import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { downloadFileFromDrive } from '@/lib/drive/files';
import { isDownloadBlocked } from '@/lib/finance/delinquency';

// RFC 5987 compliant Content-Disposition for cross-browser filename support
function makeContentDisposition(filename: string, disposition: 'attachment' | 'inline' = 'attachment') {
    // ASCII-safe fallback: replace non-ASCII chars with underscores
    const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');
    // UTF-8 encoded version for modern browsers
    const utf8Name = encodeURIComponent(filename).replace(/'/g, '%27');
    return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}

interface RouteParams {
    params: Promise<{ fileId: string }>;
}

/**
 * GET /api/files/[fileId]/download
 * Controlled download endpoint with streaming and logging.
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    const { fileId } = await params;

    try {
        const shareToken = request.nextUrl.searchParams.get('share');

        // === SHARE LINK AUTH (no login required) ===
        if (shareToken) {
            const link = await prisma.shareLink.findUnique({
                where: { token: shareToken },
            });

            if (!link || !link.isActive) {
                return NextResponse.json({ error: 'Link inválido' }, { status: 403 });
            }
            if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
                return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
            }

            // Find the file and verify it belongs to the shared project
            const file = await prisma.file.findUnique({
                where: { id: fileId },
                include: { project: true },
            });

            if (!file || file.projectId !== link.projectId || !file.isVisible) {
                return NextResponse.json({ error: 'File not found or not accessible' }, { status: 404 });
            }

            const driveFileId = file.driveFileId || `mock_file_${file.id}`;

            // Increment download count on share link
            await prisma.shareLink.update({
                where: { id: link.id },
                data: { downloadCount: { increment: 1 } },
            });

            const { stream, metadata } = await downloadFileFromDrive(file.tenantId, driveFileId);

            // Buffer the stream for iOS Safari compatibility
            const response = new Response(stream);
            const buffer = await response.arrayBuffer();

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': metadata.mimeType,
                    'Content-Disposition': makeContentDisposition(file.name),
                    'Content-Length': String(buffer.byteLength),
                },
            });
        }

        // === NORMAL SESSION AUTH ===
        // 1. Validate session
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Find the file
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

        // 3. Validate tenant access
        const tenantId = file.tenantId;
        if (session.role !== 'SUPERADMIN') {
            if (session.tenantId !== tenantId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // 4. If client user, validate client access
        const clientId = file.project.client.id;
        if (session.role === 'CLIENT_USER') {
            if (session.clientId !== clientId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // Check visibility
            if (!file.isVisible) {
                return NextResponse.json({ error: 'File not available' }, { status: 403 });
            }

            // 5. Check delinquency block
            const blockResult = await isDownloadBlocked(tenantId, clientId, file.kind);
            if (blockResult.blocked) {
                return NextResponse.json(
                    {
                        error: 'Download bloqueado por inadimplência',
                        reason: blockResult.reason,
                    },
                    { status: 403 }
                );
            }
        }

        // 6. Use driveFileId, or fallback to mock
        const driveFileId = file.driveFileId || `mock_file_${file.id}`;

        // 7. Find ClientAccess for download event
        let clientAccessId: string | null = null;
        if (session.clientId) {
            const access = await prisma.clientAccess.findFirst({
                where: { userId: session.userId, tenantId, clientId: session.clientId },
            });
            clientAccessId = access?.id || null;
        }

        // 8. Register download event STARTED
        const downloadEvent = clientAccessId ? await prisma.downloadEvent.create({
            data: {
                tenantId,
                fileId: file.id,
                clientAccessId,
                status: 'STARTED',
                ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
                userAgent: request.headers.get('user-agent') || 'unknown',
            },
        }) : null;

        // 8. Stream file from Drive
        try {
            const { stream, metadata } = await downloadFileFromDrive(tenantId, driveFileId);

            // 9. Mark download as COMPLETED
            if (downloadEvent) {
                await prisma.downloadEvent.update({
                    where: { id: downloadEvent.id },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                        bytesSent: BigInt(metadata.size),
                    },
                });
            }

            // Return buffered response (iOS Safari compatible)
            const response = new Response(stream);
            const buffer = await response.arrayBuffer();

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': metadata.mimeType,
                    'Content-Disposition': makeContentDisposition(file.name),
                    'Content-Length': String(buffer.byteLength),
                },
            });
        } catch (downloadError) {
            // 10. Mark download as FAILED
            if (downloadEvent) {
                await prisma.downloadEvent.update({
                    where: { id: downloadEvent.id },
                    data: { status: 'FAILED' },
                });
            }

            console.error('Download streaming error:', downloadError);
            return NextResponse.json(
                { error: 'Failed to download file from storage' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Download endpoint error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
