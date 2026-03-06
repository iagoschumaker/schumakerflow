import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createClientFolders } from '@/lib/drive/folders';
import { z } from 'zod';

const createSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
});

const createUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
});

// GET /api/admin/clients - List clients
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const clients = await prisma.client.findMany({
            where: { tenantId: ctx.tenantId },
            include: {
                _count: { select: { projects: true, clientAccess: true, invoices: true } },
                projects: { select: { _count: { select: { files: true } } } },
            },
            orderBy: { name: 'asc' },
        });

        // Remap for frontend compat
        const result = clients.map(c => ({
            ...c,
            _count: { ...c._count, clientUsers: c._count.clientAccess },
        }));

        return apiSuccess(result);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);

// POST /api/admin/clients - Create client
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return apiError('Invalid input', 400);

        const { name, email, phone, notes } = parsed.data;

        // Create Drive folder if tenant has a root folder
        let driveFolderId: string | undefined;
        if (ctx.tenant?.driveRootFolderId) {
            try {
                const folder = await createClientFolders(ctx.tenantId, ctx.tenant.driveRootFolderId, name);
                driveFolderId = folder.folderId;
            } catch (e) {
                console.error('Failed to create Drive folder for client:', e);
            }
        }

        const client = await prisma.client.create({
            data: {
                tenantId: ctx.tenantId,
                name,
                email,
                phone,
                notes,
                driveFolderId,
            },
        });

        // Create client user if requested
        if (body.user) {
            const userParsed = createUserSchema.safeParse(body.user);
            if (userParsed.success) {
                // Check if user already exists by email
                let existingUser = await prisma.user.findUnique({
                    where: { email: userParsed.data.email },
                });

                if (!existingUser) {
                    const passwordHash = await hashPassword(userParsed.data.password);
                    existingUser = await prisma.user.create({
                        data: {
                            email: userParsed.data.email,
                            name: userParsed.data.name,
                            passwordHash,
                            isSuperAdmin: false,
                        },
                    });
                }

                // Create ClientAccess link
                await prisma.clientAccess.create({
                    data: {
                        userId: existingUser.id,
                        tenantId: ctx.tenantId,
                        clientId: client.id,
                    },
                });
            }
        }

        // Audit log
        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.session.userId,
                action: 'client.create',
                entityType: 'Client',
                entityId: client.id,
                details: JSON.stringify({ name }),
            },
        });

        return apiSuccess(client, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
