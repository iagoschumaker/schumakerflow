import { NextRequest } from 'next/server';
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { z } from 'zod';

const createTenantSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    subdomain: z.string().optional(),
    adminName: z.string().min(1),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(8),
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

// POST /api/superadmin/tenants - Create tenant + admin user
export const POST = withSuperAdmin(async (req) => {
    const body = await req.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid input', 400);

    const { name, slug, subdomain, adminName, adminEmail, adminPassword } = parsed.data;

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return apiError('Slug already in use', 409);

    // Create tenant + admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: { name, slug, subdomain },
        });

        // Check if user already exists
        let user = await tx.user.findUnique({ where: { email: adminEmail } });
        if (!user) {
            const passwordHash = await hashPassword(adminPassword);
            user = await tx.user.create({
                data: {
                    email: adminEmail,
                    passwordHash,
                    name: adminName,
                    isSuperAdmin: false,
                },
            });
        }

        await tx.tenantMember.create({
            data: {
                tenantId: tenant.id,
                userId: user.id,
                role: 'TENANT_ADMIN',
            },
        });

        return { tenant, user: { id: user.id, email: user.email, name: user.name } };
    });

    return apiSuccess(result, 201);
});
