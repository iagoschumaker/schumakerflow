import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'dev_secret_change_in_production_32chars_min'
);

const publicPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/webhooks/',
    '/login',
    '/register',
    '/reset-password',
    '/select-context',
    '/no-access',
    '/_next/',
    '/favicon.ico',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths
    if (publicPaths.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Allow static files
    if (pathname.startsWith('/_next/') || pathname.includes('.')) {
        return NextResponse.next();
    }

    // Check session cookie
    const token = request.cookies.get('sf_session')?.value;

    if (!token) {
        // API routes return 401
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Page routes redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);

        // Add session info to headers for downstream use
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', payload.userId as string);
        requestHeaders.set('x-user-role', payload.role as string);
        if (payload.tenantId) {
            requestHeaders.set('x-tenant-id', payload.tenantId as string);
        }

        // Route protection by role
        const role = payload.role as string;

        // NO_ACCESS users can only see /no-access page and auth endpoints
        if (role === 'NO_ACCESS') {
            if (pathname.startsWith('/no-access') || pathname.startsWith('/api/auth/')) {
                return NextResponse.next({ request: { headers: requestHeaders } });
            }
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'No access' }, { status: 403 });
            }
            return NextResponse.redirect(new URL('/no-access', request.url));
        }

        if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
            if (!['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'].includes(role)) {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/portal', request.url));
            }
        }

        if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
            if (payload.role !== 'SUPERADMIN') {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/admin', request.url));
            }
        }

        if (pathname.startsWith('/portal') || pathname.startsWith('/api/portal')) {
            if (payload.role !== 'CLIENT_USER') {
                if (pathname.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/admin', request.url));
            }
        }

        return NextResponse.next({
            request: { headers: requestHeaders },
        });
    } catch {
        // Invalid token
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
