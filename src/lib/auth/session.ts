import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'dev_secret_change_in_production_32chars_min'
);

const COOKIE_NAME = 'sf_session';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface SessionPayload extends JWTPayload {
    userId: string;
    email: string;
    name: string;
    role: string; // SUPERADMIN | TENANT_ADMIN | TENANT_STAFF | CLIENT_USER
    tenantId?: string;
    clientId?: string;
}

function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'm': return value * 60 * 1000;
        case 's': return value * 1000;
        default: return 7 * 24 * 60 * 60 * 1000;
    }
}

export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
    const token = await new SignJWT(payload as JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(EXPIRES_IN)
        .sign(JWT_SECRET);

    return token;
}

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    const maxAge = parseDuration(EXPIRES_IN) / 1000;

    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    });
}

export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as SessionPayload;
    } catch {
        return null;
    }
}

export async function clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

export function requireRole(session: SessionPayload, ...allowedRoles: string[]): boolean {
    return allowedRoles.includes(session.role);
}
