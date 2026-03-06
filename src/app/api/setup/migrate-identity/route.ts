import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * POST /api/setup/migrate-identity
 * Temporary endpoint to set isSuperAdmin = true for existing users
 * that were previously SUPERADMIN via the old role column.
 * 
 * DELETE THIS FILE AFTER RUNNING ONCE.
 */
export async function POST() {
    try {
        // Set isSuperAdmin for any user that has SUPERADMIN as a string
        // Since we dropped the role column, we'll set it by known email
        const result = await prisma.user.updateMany({
            where: {
                email: { in: ['admin@schumaker.com'] },
            },
            data: { isSuperAdmin: true },
        });

        return NextResponse.json({
            data: {
                message: `Updated ${result.count} users to isSuperAdmin = true`,
            },
        });
    } catch (error: unknown) {
        console.error('Migration error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Migration failed', details: msg }, { status: 500 });
    }
}
