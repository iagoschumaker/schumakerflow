import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const passwordHash = await bcrypt.hash('admin123', 12);

    // Create tenant
    const tenant = await prisma.tenant.upsert({
        where: { slug: 'schumaker' },
        update: {},
        create: {
            name: 'Schumaker',
            slug: 'schumaker',
            subdomain: 'schumaker',
            status: 'ACTIVE',
            currency: 'BRL',
            blockAfterDays: 7,
            blockMode: 'BLOCK_FINAL_ONLY',
        },
    });

    console.log('Tenant:', tenant.name, tenant.id);

    // Create SUPERADMIN user
    const superadmin = await prisma.user.upsert({
        where: { email: 'admin@schumaker.com' },
        update: { isSuperAdmin: true },
        create: {
            email: 'admin@schumaker.com',
            passwordHash,
            name: 'Admin',
            isSuperAdmin: true,
        },
    });

    console.log('User:', superadmin.email, superadmin.id, 'superadmin:', superadmin.isSuperAdmin);

    // Link user to tenant via TenantMember (so it shows in the selection screen)
    const existingMember = await prisma.tenantMember.findFirst({
        where: { tenantId: tenant.id, userId: superadmin.id },
    });

    if (!existingMember) {
        await prisma.tenantMember.create({
            data: {
                tenantId: tenant.id,
                userId: superadmin.id,
                role: 'TENANT_ADMIN',
            },
        });
        console.log('TenantMember link created.');
    }

    console.log('');
    console.log('=== LOGIN ===');
    console.log('Email: admin@schumaker.com');
    console.log('Senha: admin123');
    console.log('Role: SUPERADMIN');
    console.log('=============');

    await pool.end();
}

main().catch(console.error);
