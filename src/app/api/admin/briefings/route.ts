import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import prisma from '@/lib/db';
import { z } from 'zod';

const listSchema = z.object({
    action: z.literal('list'),
    clientId: z.string().uuid().optional(),
    status: z.enum(['draft', 'sent', 'in_progress', 'submitted', 'archived']).optional(),
    referenceMonth: z.string().optional(),
    page: z.number().int().positive().optional(),
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

            const pageSize = 20;
            const page = parsed.data.page || 1;

            const where: Record<string, unknown> = { tenantId: ctx.tenantId };
            if (parsed.data.clientId) where.clientId = parsed.data.clientId;
            if (parsed.data.status) where.status = parsed.data.status;
            if (parsed.data.referenceMonth) where.referenceMonth = new Date(`${parsed.data.referenceMonth}-01T00:00:00.000Z`);

            const [cycles, total] = await Promise.all([
                prisma.briefingCycle.findMany({
                    where,
                    include: {
                        client: { select: { id: true, name: true } },
                        template: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                prisma.briefingCycle.count({ where }),
            ]);

            return apiSuccess({ cycles, total, page, pageSize });
        }

        if (body.action === 'get') {
            const parsed = getSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
                include: {
                    client: { select: { id: true, name: true } },
                    template: { include: { sections: { include: { fields: true }, orderBy: { sortOrder: 'asc' } } } },
                    answers: true,
                    events: { orderBy: { createdAt: 'desc' } },
                    links: true,
                },
            });
            if (!cycle) return apiError('Cycle not found', 404);

            return apiSuccess(cycle);
        }

        return apiError('Unknown action', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
