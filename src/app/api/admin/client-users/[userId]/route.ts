import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    isActive: z.boolean().optional(),
});

// PUT /api/admin/client-users/[userId] — SUPERADMIN only
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const accessId = url.pathname.split('/').pop();

        const body = await req.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) return apiError('Dados inválidos', 400);

        const access = await prisma.clientAccess.findFirst({
            where: { id: accessId, tenantId: ctx.tenantId },
            include: { user: true },
        });
        if (!access) return apiError('Acesso não encontrado', 404);

        // Update user data (name, email, password)
        const userUpdateData: Record<string, unknown> = {};
        if (parsed.data.name !== undefined) userUpdateData.name = parsed.data.name;
        if (parsed.data.email !== undefined) {
            if (parsed.data.email !== access.user.email) {
                const dup = await prisma.user.findUnique({ where: { email: parsed.data.email } });
                if (dup) return apiError('Este email já está em uso por outro usuário', 409);
            }
            userUpdateData.email = parsed.data.email;
        }
        if (parsed.data.password) {
            userUpdateData.passwordHash = await hashPassword(parsed.data.password);
        }

        if (Object.keys(userUpdateData).length > 0) {
            await prisma.user.update({
                where: { id: access.userId },
                data: userUpdateData,
            });
        }

        // Update access active status
        if (parsed.data.isActive !== undefined) {
            await prisma.clientAccess.update({
                where: { id: accessId },
                data: { isActive: parsed.data.isActive },
            });
        }

        // Re-fetch for response
        const updated = await prisma.clientAccess.findUnique({
            where: { id: accessId },
            include: {
                user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } },
                client: { select: { name: true } },
                _count: { select: { downloadEvents: true } },
            },
        });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'client_access.update',
                entityType: 'ClientAccess',
                entityId: accessId!,
                details: JSON.stringify(parsed.data),
            },
        });

        return apiSuccess({
            id: updated!.id,
            userId: updated!.user.id,
            name: updated!.user.name,
            email: updated!.user.email,
            isActive: updated!.isActive,
            client: updated!.client,
            _count: updated!._count,
        });
    },
    { roles: ['SUPERADMIN'] }  // ONLY superadmin can edit users
);

// DELETE /api/admin/client-users/[userId] — SUPERADMIN only (unlinks from flow)
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const accessId = url.pathname.split('/').pop();

        const access = await prisma.clientAccess.findFirst({
            where: { id: accessId, tenantId: ctx.tenantId },
        });
        if (!access) return apiError('Acesso não encontrado', 404);

        await prisma.clientAccess.delete({ where: { id: accessId } });

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'client_access.delete',
                entityType: 'ClientAccess',
                entityId: accessId!,
            },
        });

        return apiSuccess({ message: 'Acesso removido' });
    },
    { roles: ['SUPERADMIN'] }  // ONLY superadmin can unlink/delete
);
