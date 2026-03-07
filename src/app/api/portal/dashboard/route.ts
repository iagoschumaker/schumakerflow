import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/portal/dashboard
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        if (!ctx.session.clientId) {
            return apiError('Not a client user', 403);
        }

        const clientId = ctx.session.clientId;
        const tenantId = ctx.tenantId;

        // Get client info
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId },
            select: { id: true, name: true },
        });

        // Count projects for this client
        const totalProjects = await prisma.project.count({
            where: { clientId, tenantId },
        });

        // Find clientAccessId for this user
        const clientAccess = await prisma.clientAccess.findFirst({
            where: { userId: ctx.session.userId, tenantId, clientId },
        });

        // Get recent files
        const recentFiles = await prisma.file.findMany({
            where: {
                tenantId,
                isVisible: true,
                project: { clientId },
            },
            include: {
                project: { select: { name: true } },
                downloadEvents: clientAccess ? {
                    where: { clientAccessId: clientAccess.id },
                    orderBy: { startedAt: 'desc' },
                    take: 1,
                } : { take: 0 },
            },
            orderBy: { publishedAt: 'desc' },
            take: 10,
        });

        // Get pending invoices
        const pendingInvoices = await prisma.invoice.findMany({
            where: {
                tenantId,
                clientId,
                status: { in: ['PENDING', 'OVERDUE'] },
            },
            orderBy: { dueDate: 'asc' },
            take: 5,
        });

        // Stats
        const stats = {
            totalProjects,
            pendingInvoices: pendingInvoices.length,
        };

        return apiSuccess({
            client,
            userName: ctx.session.name,
            recentFiles: recentFiles.map((f) => ({
                ...f,
                sizeBytes: f.sizeBytes?.toString(),
                lastDownload: f.downloadEvents[0] || null,
                downloadEvents: undefined,
            })),
            pendingInvoices,
            stats,
        });
    },
    { roles: ['CLIENT_USER'] }
);
