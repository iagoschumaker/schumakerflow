import { SessionPayload } from '@/lib/auth/session';

/**
 * Validate that the session user has access to the specified tenant.
 * Prevents IDOR attacks across tenants.
 */
export function validateTenantAccess(
    session: SessionPayload,
    tenantId: string
): boolean {
    // SUPERADMIN can access any tenant
    if (session.role === 'SUPERADMIN') return true;

    // For tenant-scoped roles, session.tenantId must match
    if (!session.tenantId) return false;
    return session.tenantId === tenantId;
}

/**
 * Validate that a client user can access a specific resource.
 * The resource must belong to their client.
 */
export function validateClientAccess(
    session: SessionPayload,
    resourceClientId: string
): boolean {
    if (!session.clientId) return false;
    return session.clientId === resourceClientId;
}

/**
 * Check if user has admin-level access to the tenant.
 */
export function isTenantAdmin(session: SessionPayload): boolean {
    return (
        session.role === 'SUPERADMIN' ||
        session.role === 'TENANT_ADMIN'
    );
}

/**
 * Check if user has at least staff-level access.
 */
export function isTenantStaff(session: SessionPayload): boolean {
    return (
        session.role === 'SUPERADMIN' ||
        session.role === 'TENANT_ADMIN' ||
        session.role === 'TENANT_STAFF'
    );
}

/**
 * Build a where clause that always includes tenant_id filter.
 * Use this to prevent queries from leaking data across tenants.
 */
export function tenantWhere<T extends Record<string, unknown>>(
    tenantId: string,
    where?: T
): T & { tenantId: string } {
    return { ...where, tenantId } as T & { tenantId: string };
}
