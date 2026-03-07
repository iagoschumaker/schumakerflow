import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/portal/projects
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!ctx.session.clientId) return apiError('Not a client user', 403);

        const { searchParams } = req.nextUrl;
        const month = searchParams.get('month'); // "2026-03"
        const kind = searchParams.get('kind'); // PREVIEW | FINAL
        const onlyNew = searchParams.get('onlyNew') === 'true';
        const onlyFinal = searchParams.get('onlyFinal') === 'true';

        const where: Record<string, unknown> = {
            tenantId: ctx.tenantId,
            clientId: ctx.session.clientId,
        };

        // Find clientAccessId for download tracking
        const clientAccess = await prisma.clientAccess.findFirst({
            where: { userId: ctx.session.userId, tenantId: ctx.tenantId, clientId: ctx.session.clientId },
        });

        const projects = await prisma.project.findMany({
            where,
            include: {
                client: { select: { name: true } },
                files: {
                    where: {
                        isVisible: true,
                        ...(kind ? { kind: kind as 'PREVIEW' | 'FINAL' | 'OTHER' } : {}),
                        ...(onlyFinal ? { kind: 'FINAL' as const } : {}),
                        ...(month
                            ? {
                                publishedAt: {
                                    gte: new Date(`${month}-01`),
                                    lt: new Date(
                                        new Date(`${month}-01`).getFullYear(),
                                        new Date(`${month}-01`).getMonth() + 1,
                                        1
                                    ),
                                },
                            }
                            : {}),
                    },
                    include: {
                        downloadEvents: clientAccess ? {
                            where: {
                                clientAccessId: clientAccess.id,
                                status: 'COMPLETED',
                            },
                            orderBy: { completedAt: 'desc' },
                            take: 1,
                        } : { take: 0 },
                    },
                    orderBy: { publishedAt: 'desc' },
                },
                _count: { select: { files: { where: { isVisible: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Filter "only new" - files not yet downloaded
        const result = projects.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
            createdAt: project.createdAt,
            client: project.client,
            _count: project._count,
            files: project.files
                .filter((f) => {
                    if (onlyNew) {
                        return f.downloadEvents.length === 0;
                    }
                    return true;
                })
                .map((f) => {
                    const lastDl = f.downloadEvents[0] || null;
                    return {
                        id: f.id,
                        name: f.name,
                        kind: f.kind,
                        mimeType: f.mimeType,
                        driveFileId: f.driveFileId,
                        publishedAt: f.publishedAt,
                        sizeBytes: f.sizeBytes?.toString() ?? null,
                        lastDownload: lastDl ? { completedAt: lastDl.completedAt } : null,
                        isNew: f.downloadEvents.length === 0,
                    };
                }),
        }));

        return apiSuccess(result);
    },
    { roles: ['CLIENT_USER'] }
);
