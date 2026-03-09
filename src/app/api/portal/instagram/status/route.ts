import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET — list connected accounts
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        if (!ctx.clientId) return apiError('Cliente não identificado', 400);
        const accounts = await (prisma as any).clientInstagram.findMany({
            where: { clientId: ctx.clientId },
            select: { id: true, username: true, igUserId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        return apiSuccess({ accounts });
    },
    { roles: ['CLIENT_USER'] }
);

// DELETE — disconnect specific account
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!ctx.clientId) return apiError('Cliente não identificado', 400);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return apiError('id obrigatório', 400);

        const account = await (prisma as any).clientInstagram.findFirst({
            where: { id, clientId: ctx.clientId },
        });
        if (!account) return apiError('Conta não encontrada', 404);

        await (prisma as any).clientInstagram.delete({ where: { id } });
        return apiSuccess({ disconnected: true });
    },
    { roles: ['CLIENT_USER'] }
);
