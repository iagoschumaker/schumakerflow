import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import prisma from '@/lib/db';
import { z } from 'zod';

const listSchema = z.object({
    action: z.literal('list'),
    isActive: z.boolean().optional(),
});

const getSchema = z.object({
    action: z.literal('get'),
    id: z.string().uuid(),
});

export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!isBriefingsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();

        if (body.action === 'list') {
            const parsed = listSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const where: Record<string, unknown> = { tenantId: ctx.tenantId };
            if (parsed.data.isActive !== undefined) where.isActive = parsed.data.isActive;

            const templates = await prisma.briefingTemplate.findMany({
                where,
                orderBy: { createdAt: 'desc' },
            });

            return apiSuccess(templates);
        }

        if (body.action === 'get') {
            const parsed = getSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const template = await prisma.briefingTemplate.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
                include: {
                    sections: {
                        include: { fields: { orderBy: { sortOrder: 'asc' } } },
                        orderBy: { sortOrder: 'asc' },
                    },
                },
            });
            if (!template) return apiError('Template not found', 404);

            return apiSuccess(template);
        }

        return apiError('Unknown action', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
