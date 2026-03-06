import { google, drive_v3 } from 'googleapis';
import prisma from '@/lib/db';

/**
 * Check if Google OAuth is configured globally (env vars).
 */
export function isOAuthConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Check if a tenant has Drive connected (has refresh token).
 */
export async function isDriveConfiguredForTenant(tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { driveRefreshToken: true },
    });
    return !!tenant?.driveRefreshToken;
}

/**
 * Get an authenticated Google Drive client for a specific tenant.
 * Uses the tenant's OAuth2 tokens and auto-refreshes if expired.
 */
export async function getDriveClientForTenant(tenantId: string): Promise<drive_v3.Drive> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            driveRefreshToken: true,
            driveAccessToken: true,
            driveTokenExpiry: true,
        },
    });

    if (!tenant?.driveRefreshToken) {
        throw new Error('Google Drive not connected for this tenant. Go to Settings to connect.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
        refresh_token: tenant.driveRefreshToken,
        access_token: tenant.driveAccessToken || undefined,
        expiry_date: tenant.driveTokenExpiry ? tenant.driveTokenExpiry.getTime() : undefined,
    });

    // Check if token needs refresh
    const isExpired = tenant.driveTokenExpiry
        ? new Date(tenant.driveTokenExpiry).getTime() < Date.now() + 60_000
        : true;

    if (isExpired) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);

            // Persist the new tokens
            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    driveAccessToken: credentials.access_token || undefined,
                    driveTokenExpiry: credentials.expiry_date
                        ? new Date(credentials.expiry_date)
                        : undefined,
                    // refresh_token is only returned on first auth, keep existing
                },
            });
        } catch (e) {
            console.error('Failed to refresh Drive token for tenant:', tenantId, e);
            throw new Error('Failed to refresh Google Drive token. Please reconnect in Settings.');
        }
    }

    return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Legacy: Check if Drive is configured (for backwards compat during transition).
 */
export function isDriveConfigured(): boolean {
    return isOAuthConfigured();
}
