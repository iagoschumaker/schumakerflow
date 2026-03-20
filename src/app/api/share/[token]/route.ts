import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/share/[token] - Public API: get project files for a share link
export async function GET(req: NextRequest) {
    const token = req.nextUrl.pathname.split('/').pop()!;

    const link = await prisma.shareLink.findUnique({
        where: { token },
        include: {
            project: {
                include: {
                    client: { select: { name: true } },
                    files: {
                        where: { isVisible: true },
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            name: true,
                            kind: true,
                            mimeType: true,
                            sizeBytes: true,
                            createdAt: true,
                        },
                    },
                },
            },
            tenant: {
                select: { name: true, logoUrl: true, primaryColor: true },
            },
        },
    });

    if (!link || !link.isActive) {
        return NextResponse.json(
            { error: 'Link inválido ou desativado.' },
            { status: 404 }
        );
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return NextResponse.json(
            { error: 'Este link expirou.' },
            { status: 410 }
        );
    }

    // Increment view count
    await prisma.shareLink.update({
        where: { id: link.id },
        data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
        project: {
            name: link.project?.name,
            clientName: link.project?.client?.name,
        },
        tenant: link.tenant,
        files: link.project?.files || [],
        label: link.label,
        expiresAt: link.expiresAt,
    });
}
