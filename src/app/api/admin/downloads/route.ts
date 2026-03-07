import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/admin/downloads
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const fileId = req.nextUrl.searchParams.get('fileId');
        const clientAccessId = req.nextUrl.searchParams.get('clientAccessId');

        const where: Record<string, unknown> = { tenantId: ctx.tenantId };
        if (fileId) where.fileId = fileId;
        if (clientAccessId) where.clientAccessId = clientAccessId;

        const events = await prisma.downloadEvent.findMany({
            where,
            include: {
                file: {
                    select: {
                        name: true,
                        kind: true,
                        project: {
                            select: {
                                name: true,
                                client: { select: { name: true } },
                            },
                        },
                    },
                },
                clientAccess: {
                    include: {
                        user: { select: { name: true, email: true } },
                    },
                },
            },
            orderBy: { startedAt: 'desc' },
            take: 200,
        });

        // Flatten for frontend compatibility — avoid BigInt serialization crash
        const result = events.map(e => ({
            id: e.id,
            tenantId: e.tenantId,
            fileId: e.fileId,
            clientAccessId: e.clientAccessId,
            status: e.status,
            ip: e.ip,
            userAgent: e.userAgent,
            bytesSent: e.bytesSent ? String(e.bytesSent) : null,
            startedAt: e.startedAt,
            completedAt: e.completedAt,
            file: e.file,
            // Provide clientUser-like shape for backward compatibility
            clientUser: e.clientAccess ? {
                name: e.clientAccess.user.name,
                email: e.clientAccess.user.email,
            } : null,
        }));

        return apiSuccess(result);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
