/**
 * Data Migration: ClientUser → User + ClientAccess
 * 
 * For each ClientUser:
 * 1. Check if a User with that email already exists
 *    - YES → Create ClientAccess linking existing User to the Client
 *    - NO  → Create User with ClientUser data, then create ClientAccess
 * 2. Update any DownloadEvents that referenced the old ClientUser
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting ClientUser → User + ClientAccess migration...');

    // Check if ClientUser table still exists (it might have been dropped by db push)
    try {
        const result = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'ClientUser' AND table_schema = 'public'
        `;
        const exists = Number(result[0]?.count) > 0;
        if (!exists) {
            console.log('ClientUser table does not exist (already migrated or dropped). Nothing to do.');

            // Still need to update existing Users: set isSuperAdmin for SUPERADMIN role users
            // The old 'role' column may still exist
            try {
                await prisma.$executeRaw`
                    UPDATE "User" SET "isSuperAdmin" = true WHERE "role" = 'SUPERADMIN'
                `;
                console.log('Updated isSuperAdmin flags for existing SUPERADMIN users.');
            } catch (e) {
                console.log('Could not update isSuperAdmin (column "role" may already be removed):', e.message);
            }

            return;
        }
    } catch (e) {
        console.log('Could not check for ClientUser table:', e.message);
        return;
    }

    // Get all ClientUsers
    const clientUsers = await prisma.$queryRaw`SELECT * FROM "ClientUser"`;
    console.log(`Found ${clientUsers.length} ClientUser records to migrate.`);

    for (const cu of clientUsers) {
        // Check if User with this email exists
        const existingUser = await prisma.user.findUnique({
            where: { email: cu.email },
        });

        let userId;

        if (existingUser) {
            console.log(`  User exists for ${cu.email} → linking`);
            userId = existingUser.id;
        } else {
            console.log(`  Creating User for ${cu.email}`);
            const newUser = await prisma.user.create({
                data: {
                    email: cu.email,
                    passwordHash: cu.passwordHash,
                    name: cu.name,
                    isSuperAdmin: false,
                    isActive: cu.isActive,
                    lastLoginAt: cu.lastLoginAt,
                },
            });
            userId = newUser.id;
        }

        // Create ClientAccess
        try {
            await prisma.clientAccess.create({
                data: {
                    userId,
                    tenantId: cu.tenantId,
                    clientId: cu.clientId,
                    isActive: cu.isActive,
                },
            });
            console.log(`  Created ClientAccess for user ${cu.email} → client ${cu.clientId}`);
        } catch (e) {
            console.log(`  ClientAccess already exists for ${cu.email} → ${cu.clientId}, skipping`);
        }

        // Update DownloadEvents
        try {
            const updated = await prisma.$executeRaw`
                UPDATE "DownloadEvent" SET "clientAccessId" = ${userId} 
                WHERE "clientUserId" = ${cu.id}
            `;
            if (updated > 0) console.log(`  Migrated ${updated} download events`);
        } catch (e) {
            // clientUserId column may already be removed
        }
    }

    // Set isSuperAdmin for SUPERADMIN users
    try {
        await prisma.$executeRaw`
            UPDATE "User" SET "isSuperAdmin" = true WHERE "role" = 'SUPERADMIN'
        `;
        console.log('Updated isSuperAdmin flags.');
    } catch (e) {
        console.log('Could not set isSuperAdmin flags:', e.message);
    }

    console.log('Migration complete!');
}

migrate()
    .catch(e => console.error('Migration failed:', e))
    .finally(() => prisma.$disconnect());
