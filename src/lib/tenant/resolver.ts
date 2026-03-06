import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import type { Tenant } from '@prisma/client';

const TENANT_DOMAIN = process.env.TENANT_DOMAIN || 'localhost';

/**
 * Resolve tenant from request.
 * Priority: 1) subdomain  2) slug in path  3) query param
 */
export async function resolveTenant(request: NextRequest): Promise<Tenant | null> {
    // 1. Try subdomain
    const hostname = request.headers.get('host') || '';
    const subdomain = extractSubdomain(hostname);

    if (subdomain) {
        const tenant = await prisma.tenant.findUnique({
            where: { subdomain, status: 'ACTIVE' },
        });
        if (tenant) return tenant;
    }

    // 2. Try slug from path: /t/{slug}/...
    const pathname = request.nextUrl.pathname;
    const slugMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);
    if (slugMatch) {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: slugMatch[1], status: 'ACTIVE' },
        });
        if (tenant) return tenant;
    }

    // 3. Try x-tenant-slug header (for API calls)
    const headerSlug = request.headers.get('x-tenant-slug');
    if (headerSlug) {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: headerSlug, status: 'ACTIVE' },
        });
        if (tenant) return tenant;
    }

    return null;
}

/**
 * Extract subdomain from hostname.
 * e.g. "tenant1.schumakerflow.com" → "tenant1"
 * e.g. "localhost:3000" → null
 */
function extractSubdomain(hostname: string): string | null {
    // Remove port
    const host = hostname.split(':')[0];

    // In dev, subdomains on localhost don't work well
    if (host === 'localhost' || host === '127.0.0.1') {
        return null;
    }

    const parts = host.split('.');
    const domainParts = TENANT_DOMAIN.split('.');

    // Must have more parts than the base domain
    if (parts.length > domainParts.length) {
        // The subdomain is everything before the base domain
        const subdomainParts = parts.slice(0, parts.length - domainParts.length);
        const subdomain = subdomainParts.join('.');
        // Skip www
        if (subdomain === 'www') return null;
        return subdomain;
    }

    return null;
}

/**
 * Resolve tenant by slug directly (for server-side use)
 */
export async function resolveTenantBySlug(slug: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({
        where: { slug, status: 'ACTIVE' },
    });
}

/**
 * Resolve tenant by ID directly
 */
export async function resolveTenantById(tenantId: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({
        where: { id: tenantId, status: 'ACTIVE' },
    });
}
