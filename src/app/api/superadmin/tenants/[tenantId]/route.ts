import { NextRequest } from 'next/server';
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL']).optional(),
    blockAfterDays: z.number().int().optional(),
    blockMode: z.string().optional(),
    resetPassword: z.string().min(8).optional(),
});

// PUT /api/superadmin/tenants/[tenantId]
export const PUT = withSuperAdmin(async (req) => {
    const tenantId = req.nextUrl.pathname.split('/').pop();

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) return apiError('Flow not found', 404);

    // Handle password reset for tenant admin
    if (parsed.data.resetPassword) {
        const adminMember = await prisma.tenantMember.findFirst({
            where: { tenantId, role: 'TENANT_ADMIN' },
            include: { user: true },
        });
        if (adminMember) {
            const hashedPassword = await bcrypt.hash(parsed.data.resetPassword, 12);
            await prisma.user.update({
                where: { id: adminMember.userId },
                data: { passwordHash: hashedPassword },
            });
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { resetPassword, ...tenantData } = parsed.data;

    const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: tenantData,
    });

    return apiSuccess(tenant);
});

// DELETE /api/superadmin/tenants/[tenantId]
export const DELETE = withSuperAdmin(async (req) => {
    const tenantId = req.nextUrl.pathname.split('/').pop();

    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) return apiError('Tenant not found', 404);

    // Delete tenant and all related data (cascading via Prisma schema)
    await prisma.tenant.delete({ where: { id: tenantId } });

    return apiSuccess({ message: 'Tenant deleted' });
});
