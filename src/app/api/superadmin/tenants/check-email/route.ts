import { NextRequest } from 'next/server';
import { withSuperAdmin, apiSuccess } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/superadmin/tenants/check-email?email=xxx
export const GET = withSuperAdmin(async (req) => {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.trim().toLowerCase();

    if (!email) {
        return apiSuccess({ exists: false });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    return apiSuccess({ exists: !!user, userName: user?.name || null });
});
