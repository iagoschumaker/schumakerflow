import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/admin/settings/drive/status
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: {
                driveEmail: true,
                driveRootFolderId: true,
                driveRefreshToken: true,
                driveTokenExpiry: true,
            },
        });

        const connected = !!(tenant?.driveRefreshToken);
        const expired = tenant?.driveTokenExpiry
            ? new Date(tenant.driveTokenExpiry) < new Date()
            : false;

        return apiSuccess({
            connected,
            email: tenant?.driveEmail || null,
            rootFolderId: tenant?.driveRootFolderId || null,
            tokenExpired: expired,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
