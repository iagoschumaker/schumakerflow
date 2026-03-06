import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const linkSchema = z.object({
    clientId: z.string().uuid(),
    email: z.string().email(),
});

// GET /api/admin/client-users
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const clientId = req.nextUrl.searchParams.get('clientId');
        const where: Record<string, unknown> = { tenantId: ctx.tenantId };
        if (clientId) where.clientId = clientId;

        const accessList = await prisma.clientAccess.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, createdAt: true } },
                client: { select: { name: true } },
                _count: { select: { downloadEvents: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Flatten to match frontend shape
        const result = accessList.map((a: typeof accessList[0]) => ({
            id: a.id,
            userId: a.user.id,
            name: a.user.name,
            email: a.user.email,
            isActive: a.isActive && a.user.isActive,
            clientId: a.clientId,
            tenantId: a.tenantId,
            lastLoginAt: a.user.lastLoginAt,
            createdAt: a.createdAt,
            client: a.client,
            _count: a._count,
        }));

        return apiSuccess(result);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// POST /api/admin/client-users — link-only (user must already exist)
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = linkSchema.safeParse(body);
        if (!parsed.success) return apiError('Dados inválidos', 400);

        // Verify client belongs to tenant
        const client = await prisma.client.findFirst({
            where: { id: parsed.data.clientId, tenantId: ctx.tenantId },
        });
        if (!client) return apiError('Cliente não encontrado', 404);

        // User MUST already exist
        const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
        });

        if (!user) {
            return apiError('Usuário não encontrado. O usuário precisa se cadastrar primeiro.', 404);
        }

        // Check if access already exists
        const existingAccess = await prisma.clientAccess.findFirst({
            where: { userId: user.id, tenantId: ctx.tenantId, clientId: parsed.data.clientId },
        });
        if (existingAccess) return apiError('Este usuário já tem acesso a este cliente', 409);

        // Create ClientAccess link
        const access = await prisma.clientAccess.create({
            data: {
                userId: user.id,
                tenantId: ctx.tenantId,
                clientId: parsed.data.clientId,
            },
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'client_access.create',
                entityType: 'ClientAccess',
                entityId: access.id,
                details: JSON.stringify({ name: user.name, email: user.email }),
            },
        });

        return apiSuccess({
            id: access.id,
            userId: user.id,
            name: user.name,
            email: user.email,
        }, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
