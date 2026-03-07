import { google, calendar_v3 } from 'googleapis';
import prisma from '@/lib/db';

/**
 * Get an authenticated Google Calendar client for a specific tenant.
 * Reuses the same OAuth tokens stored by the Drive integration.
 */
export async function getCalendarClient(tenantId: string): Promise<calendar_v3.Calendar> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            driveRefreshToken: true,
            driveAccessToken: true,
            driveTokenExpiry: true,
        },
    });

    if (!tenant?.driveRefreshToken) {
        throw new Error('Google não conectado. Vá em Configurações para conectar o Google.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados.');
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

            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    driveAccessToken: credentials.access_token || undefined,
                    driveTokenExpiry: credentials.expiry_date
                        ? new Date(credentials.expiry_date)
                        : undefined,
                },
            });
        } catch (e) {
            console.error('Failed to refresh token for Calendar:', tenantId, e);
            throw new Error('Falha ao atualizar token do Google. Reconecte nas Configurações.');
        }
    }

    return google.calendar({ version: 'v3', auth: oauth2Client });
}
