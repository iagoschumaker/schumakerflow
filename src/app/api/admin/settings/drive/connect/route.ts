import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, ApiContext } from '@/lib/api/helpers';
import { google } from 'googleapis';

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    }

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        `${baseUrl}/api/admin/settings/drive/callback`
    );
}

// GET /api/admin/settings/drive/connect
// Redirects to Google OAuth consent screen
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        try {
            const oauth2Client = getOAuth2Client();

            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/calendar',
                ],
                state: ctx.tenantId, // Pass tenantId through OAuth state
            });

            return NextResponse.redirect(authUrl);
        } catch (e) {
            console.error('Drive connect error:', e);
            return apiError('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env', 500);
        }
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
