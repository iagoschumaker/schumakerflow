import { google, calendar_v3 } from 'googleapis';
import prisma from '@/lib/db';

/**
 * Get an authenticated Google Calendar client for a specific tenant.
 * Reuses the same OAuth2 tokens as Google Drive (stored on the Tenant model).
 */
export async function getCalendarClientForTenant(tenantId: string): Promise<calendar_v3.Calendar> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            driveRefreshToken: true,
            driveAccessToken: true,
            driveTokenExpiry: true,
        },
    });

    if (!tenant?.driveRefreshToken) {
        throw new Error('Google not connected for this tenant. Connect via Settings.');
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
            console.error('Failed to refresh token for calendar:', tenantId, e);
            throw new Error('Failed to refresh Google token. Please reconnect in Settings.');
        }
    }

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Fetch events from Google Calendar for a given time range.
 */
export async function getCalendarEvents(
    tenantId: string,
    timeMin: Date,
    timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
    try {
        const calendar = await getCalendarClientForTenant(tenantId);

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100,
        });

        return res.data.items || [];
    } catch (e) {
        console.error('Failed to fetch calendar events:', e);
        return [];
    }
}

/**
 * Create a calendar event.
 */
export async function createCalendarEvent(
    tenantId: string,
    summary: string,
    description: string,
    startDate: Date,
    endDate: Date,
    allDay: boolean = false
): Promise<calendar_v3.Schema$Event | null> {
    try {
        const calendar = await getCalendarClientForTenant(tenantId);

        const event: calendar_v3.Schema$Event = {
            summary,
            description,
            start: allDay
                ? { date: startDate.toISOString().slice(0, 10) }
                : { dateTime: startDate.toISOString() },
            end: allDay
                ? { date: endDate.toISOString().slice(0, 10) }
                : { dateTime: endDate.toISOString() },
        };

        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });

        return res.data;
    } catch (e) {
        console.error('Failed to create calendar event:', e);
        return null;
    }
}
