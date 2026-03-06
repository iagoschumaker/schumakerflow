import { NextRequest } from 'next/server';
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { z } from 'zod';
import crypto from 'crypto';

const createTenantSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    subdomain: z.string().optional(),
    adminName: z.string().min(1),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(8).optional(),
});

// GET /api/superadmin/tenants
export const GET = withSuperAdmin(async (_req) => {
    const tenants = await prisma.tenant.findMany({
        include: {
            _count: {
                select: { clients: true, members: true, invoices: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(tenants);
});

// POST /api/superadmin/tenants - Create tenant + admin user (or link existing)
export const POST = withSuperAdmin(async (req) => {
    try {
        const body = await req.json();
        const parsed = createTenantSchema.safeParse(body);
        if (!parsed.success) return apiError('Dados inválidos: ' + parsed.error.issues.map(i => i.message).join(', '), 400);

        const { name, slug, subdomain, adminName, adminEmail, adminPassword } = parsed.data;

        // Check slug uniqueness
        const existing = await prisma.tenant.findUnique({ where: { slug } });
        if (existing) return apiError('Slug já está em uso', 409);

        // Create tenant + admin user in transaction
        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { name, slug, subdomain },
            });

            // Check if user already exists — if so, just link them
            let user = await tx.user.findUnique({ where: { email: adminEmail } });
            const isExistingUser = !!user;

            if (!user) {
                // Auto-generate a secure password for new users if none provided
                const rawPassword = adminPassword || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
                const passwordHash = await hashPassword(rawPassword);
                user = await tx.user.create({
                    data: {
                        email: adminEmail,
                        passwordHash,
                        name: adminName,
                        isSuperAdmin: false,
                    },
                });
            }

            // Check if already a member of this tenant
            const existingMember = await tx.tenantMember.findUnique({
                where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
            });

            if (!existingMember) {
                await tx.tenantMember.create({
                    data: {
                        tenantId: tenant.id,
                        userId: user.id,
                        role: 'TENANT_ADMIN',
                    },
                });
            }

            return {
                tenant,
                user: { id: user.id, email: user.email, name: user.name },
                linkedExisting: isExistingUser,
            };
        });

        return apiSuccess(result, 201);
    } catch (error: any) {
        console.error('Error creating tenant:', error);
        return apiError(error?.message || 'Erro interno ao criar flow', 500);
    }
});
