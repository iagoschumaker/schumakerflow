import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession, setSessionCookie } from '@/lib/auth/session';
import prisma from '@/lib/db';

/**
 * POST /api/auth/select-tenant
 * Called after login when a SUPERADMIN or multi-tenant user selects a tenant.
 * Re-creates the session with the chosen tenantId.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { tenantSlug } = body;

        if (!tenantSlug) {
            return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
        }

        // Find the tenant
        const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // SUPERADMIN can access any tenant
        if (session.role === 'SUPERADMIN') {
            const token = await createSession({
                userId: session.userId,
                email: session.email,
                name: session.name,
                role: session.role,
                tenantId: tenant.id,
            });
            await setSessionCookie(token);
            return NextResponse.json({ data: { tenantId: tenant.id, tenantName: tenant.name } });
        }

        // For other roles, verify they have an active membership
        const membership = await prisma.tenantMember.findFirst({
            where: {
                userId: session.userId,
                tenantId: tenant.id,
                isActive: true,
            },
        });

        if (!membership) {
            return NextResponse.json({ error: 'No access to this tenant' }, { status: 403 });
        }

        const token = await createSession({
            userId: session.userId,
            email: session.email,
            name: session.name,
            role: membership.role,
            tenantId: tenant.id,
        });
        await setSessionCookie(token);

        return NextResponse.json({ data: { tenantId: tenant.id, tenantName: tenant.name } });
    } catch (error) {
        console.error('Select tenant error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
