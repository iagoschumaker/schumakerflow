import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import prisma from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const listSchema = z.object({ action: z.literal('list'), clientId: z.string().uuid() });

const createSchema = z.object({
    action: z.literal('create'),
    clientId: z.string().uuid(),
    key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'A chave só pode ter letras minúsculas, números e underscore.'),
    name: z.string().min(1),
    items: z.array(z.string().min(1)),
});

const updateSchema = z.object({
    action: z.literal('update'),
    id: z.string().uuid(),
    name: z.string().min(1),
    items: z.array(z.string().min(1)),
});

const deleteSchema = z.object({ action: z.literal('delete'), id: z.string().uuid() });

export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!isBriefingsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();

        if (body.action === 'list') {
            const parsed = listSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, tenantId: ctx.tenantId } });
            if (!client) return apiError('Client not found', 404);

            const lists = await prisma.briefingClientList.findMany({
                where: { tenantId: ctx.tenantId, clientId: parsed.data.clientId },
                orderBy: { createdAt: 'asc' },
            });
            return apiSuccess(lists);
        }

        if (body.action === 'create') {
            const parsed = createSchema.safeParse(body);
            if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400);

            const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, tenantId: ctx.tenantId } });
            if (!client) return apiError('Client not found', 404);

            try {
                const list = await prisma.briefingClientList.create({
                    data: {
                        tenantId: ctx.tenantId,
                        clientId: parsed.data.clientId,
                        key: parsed.data.key,
                        name: parsed.data.name,
                        items: parsed.data.items,
                    },
                });
                return apiSuccess(list, 201);
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    return apiError('Já existe uma lista com essa chave para este cliente.', 409);
                }
                throw e;
            }
        }

        if (body.action === 'update') {
            const parsed = updateSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const list = await prisma.briefingClientList.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!list) return apiError('List not found', 404);

            const updated = await prisma.briefingClientList.update({
                where: { id: list.id },
                data: { name: parsed.data.name, items: parsed.data.items },
            });
            return apiSuccess(updated);
        }

        if (body.action === 'delete') {
            const parsed = deleteSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const list = await prisma.briefingClientList.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!list) return apiError('List not found', 404);

            await prisma.briefingClientList.delete({ where: { id: list.id } });
            return apiSuccess({ ok: true });
        }

        return apiError('Unknown action', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
