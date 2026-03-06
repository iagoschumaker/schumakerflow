import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
});

// GET /api/admin/clients/[clientId] - Get single client
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const url = new URL(_req.url);
        const clientId = url.pathname.split('/').pop();

        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId: ctx.tenantId },
            include: {
                projects: { include: { _count: { select: { files: true } } }, orderBy: { createdAt: 'desc' } },
                clientAccess: {
                    include: { user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } } },
                },
                contracts: true,
                _count: { select: { invoices: true } },
            },
        });

        if (!client) return apiError('Client not found', 404);

        // Flatten clientAccess to match frontend's clientUsers shape
        const result = {
            ...client,
            clientUsers: client.clientAccess.map((a: typeof client.clientAccess[0]) => ({
                id: a.id,
                name: a.user.name,
                email: a.user.email,
                isActive: a.isActive && a.user.isActive,
                lastLoginAt: a.user.lastLoginAt,
            })),
            clientAccess: undefined,
        };

        return apiSuccess(result);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// PUT /api/admin/clients/[clientId] - Update client
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const clientId = url.pathname.split('/').pop();

        const body = await req.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return apiError('Invalid input', 400);

        const existing = await prisma.client.findFirst({
            where: { id: clientId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('Client not found', 404);

        const updated = await prisma.client.update({
            where: { id: clientId },
            data: parsed.data,
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'client.update',
                entityType: 'Client',
                entityId: clientId!,
                details: JSON.stringify(parsed.data),
            },
        });

        return apiSuccess(updated);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/clients/[clientId]
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const clientId = url.pathname.split('/').pop();

        const existing = await prisma.client.findFirst({
            where: { id: clientId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('Client not found', 404);

        await prisma.client.delete({ where: { id: clientId } });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'client.delete',
                entityType: 'Client',
                entityId: clientId!,
            },
        });

        return apiSuccess({ message: 'Client deleted' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// POST /api/admin/clients/[clientId]/users — link existing user only
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const segments = url.pathname.split('/');
        const clientId = segments[segments.length - 1];

        const body = await req.json();
        const linkSchema = z.object({
            email: z.string().email(),
        });

        const parsed = linkSchema.safeParse(body);
        if (!parsed.success) return apiError('Email inválido', 400);

        // Verify client belongs to tenant
        const client = await prisma.client.findFirst({
            where: { id: clientId, tenantId: ctx.tenantId },
        });
        if (!client) return apiError('Cliente não encontrado', 404);

        // User MUST already exist
        const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
        });

        if (!user) {
            return apiError('Usuário não encontrado. O usuário precisa se cadastrar primeiro.', 404);
        }

        // Check if already has access
        const existingAccess = await prisma.clientAccess.findFirst({
            where: { userId: user.id, tenantId: ctx.tenantId, clientId: clientId! },
        });
        if (existingAccess) return apiError('Este usuário já tem acesso a este cliente', 409);

        const access = await prisma.clientAccess.create({
            data: {
                userId: user.id,
                tenantId: ctx.tenantId,
                clientId: clientId!,
            },
        });

        return apiSuccess({
            id: access.id,
            name: user.name,
            email: user.email,
            isActive: true,
        }, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
