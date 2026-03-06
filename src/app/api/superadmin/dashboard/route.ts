import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/superadmin/dashboard
export const GET = withAuth(
    async (_req: NextRequest, _ctx: ApiContext) => {
        const [tenantCount, totalMembers, totalClients, totalProjects, totalFiles, totalInvoices, recentTenants] = await Promise.all([
            prisma.tenant.count(),
            prisma.user.count(),
            prisma.client.count(),
            prisma.project.count(),
            prisma.file.count(),
            prisma.invoice.count(),
            prisma.tenant.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    createdAt: true,
                    _count: { select: { clients: true, members: true } },
                },
            }),
        ]);

        const activeTenants = await prisma.tenant.count({ where: { status: 'ACTIVE' } });
        const suspendedTenants = await prisma.tenant.count({ where: { status: 'SUSPENDED' } });

        return apiSuccess({
            tenants: tenantCount,
            activeTenants,
            suspendedTenants,
            members: totalMembers,
            clients: totalClients,
            projects: totalProjects,
            files: totalFiles,
            invoices: totalInvoices,
            recentTenants,
        });
    },
    { roles: ['SUPERADMIN'], requireTenant: false }
);

