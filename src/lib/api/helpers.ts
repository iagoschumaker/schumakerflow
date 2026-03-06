import { NextRequest, NextResponse } from 'next/server';
import { getSession, SessionPayload } from '@/lib/auth/session';
import { resolveTenant } from '@/lib/tenant/resolver';
import { validateTenantAccess } from '@/lib/tenant/guard';
import { Tenant } from '@prisma/client';
import prisma from '@/lib/db';

export interface ApiContext {
    session: SessionPayload;
    tenant: Tenant | null;
    tenantId: string;
}

/**
 * Wrap an API route handler with auth + tenant validation.
 */
export function withAuth(
    handler: (req: NextRequest, ctx: ApiContext) => Promise<NextResponse>,
    options?: {
        roles?: string[];
        requireTenant?: boolean;
    }
) {
    return async (req: NextRequest) => {
        try {
            const session = await getSession();
            if (!session) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Check role
            if (options?.roles && !options.roles.includes(session.role)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            let tenant: Tenant | null = null;
            let tenantId = session.tenantId || '';

            // Resolve tenant if required
            if (options?.requireTenant !== false) {
                tenant = await resolveTenant(req);

                // If no tenant from request, try from session
                if (!tenant && session.tenantId) {
                    tenant = await prisma.tenant.findUnique({
                        where: { id: session.tenantId, status: 'ACTIVE' },
                    });
                }

                if (!tenant) {
                    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
                }

                tenantId = tenant.id;

                // Validate tenant access
                if (!validateTenantAccess(session, tenantId)) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
            }

            return handler(req, { session, tenant, tenantId });
        } catch (error) {
            console.error('API Error:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    };
}

/**
 * Wrap a superadmin-only route.
 */
export function withSuperAdmin(
    handler: (req: NextRequest, ctx: { session: SessionPayload }) => Promise<NextResponse>
) {
    return withAuth(
        async (req, ctx) => handler(req, { session: ctx.session }),
        { roles: ['SUPERADMIN'], requireTenant: false }
    );
}

/**
 * Wrap a cron/job route with secret validation.
 */
export function withCronAuth(
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest) => {
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return handler(req);
    };
}

/**
 * Standard error response
 */
export function apiError(message: string, status: number = 400) {
    return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response
 */
export function apiSuccess<T>(data: T, status: number = 200) {
    return NextResponse.json({ data }, { status });
}
