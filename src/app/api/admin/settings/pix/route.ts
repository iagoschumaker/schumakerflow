import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const pixSchema = z.object({
    pixKey: z.string().min(1),
    pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
    pixReceiverName: z.string().min(1),
});

// GET /api/admin/settings/pix
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { pixKey: true, pixKeyType: true, pixReceiverName: true },
        });
        return apiSuccess(tenant);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// PUT /api/admin/settings/pix
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = pixSchema.safeParse(body);
        if (!parsed.success) return apiError('Dados inválidos', 400);

        const tenant = await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: {
                pixKey: parsed.data.pixKey,
                pixKeyType: parsed.data.pixKeyType,
                pixReceiverName: parsed.data.pixReceiverName,
            },
            select: { pixKey: true, pixKeyType: true, pixReceiverName: true },
        });

        return apiSuccess(tenant);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/settings/pix
export const DELETE = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: { pixKey: null, pixKeyType: null, pixReceiverName: null },
        });
        return apiSuccess({ message: 'PIX removido' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
