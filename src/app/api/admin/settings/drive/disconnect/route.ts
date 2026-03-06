import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// POST /api/admin/settings/drive/disconnect
export const POST = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: {
                driveRefreshToken: null,
                driveAccessToken: null,
                driveTokenExpiry: null,
                driveEmail: null,
                // Keep driveRootFolderId so existing file references still work
            },
        });

        return apiSuccess({ message: 'Google Drive disconnected' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
