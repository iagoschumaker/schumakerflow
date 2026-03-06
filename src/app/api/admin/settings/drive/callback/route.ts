import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/session';

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        `${baseUrl}/api/admin/settings/drive/callback`
    );
}

// GET /api/admin/settings/drive/callback
// Handles Google OAuth redirect, stores tokens in Tenant
export async function GET(req: NextRequest) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    try {
        const code = req.nextUrl.searchParams.get('code');
        const state = req.nextUrl.searchParams.get('state'); // tenantId

        if (!code || !state) {
            return NextResponse.redirect(`${baseUrl}/admin/settings?drive=error&msg=missing_params`);
        }

        // Verify user is authenticated
        const session = await getSession();
        if (!session) {
            return NextResponse.redirect(`${baseUrl}/login`);
        }

        const oauth2Client = getOAuth2Client();

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user email from Google
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const driveEmail = userInfo.data.email || '';

        // Find or create root folder "SCHUMAKER FLOW" in Drive
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const tenant = await prisma.tenant.findUnique({ where: { id: state } });
        let rootFolderId = tenant?.driveRootFolderId;

        if (!rootFolderId) {
            // Search for existing "SCHUMAKER FLOW" folder
            const searchRes = await drive.files.list({
                q: "name = 'SCHUMAKER FLOW' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            if (searchRes.data.files && searchRes.data.files.length > 0) {
                // Use existing folder
                rootFolderId = searchRes.data.files[0].id || undefined;
                console.log(`[Drive] Found existing SCHUMAKER FLOW folder: ${rootFolderId}`);
            } else {
                // Create new "SCHUMAKER FLOW" folder
                const folderRes = await drive.files.create({
                    requestBody: {
                        name: 'SCHUMAKER FLOW',
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id',
                });
                rootFolderId = folderRes.data.id || undefined;
                console.log(`[Drive] Created SCHUMAKER FLOW folder: ${rootFolderId}`);
            }
        }

        // Store tokens in Tenant
        await prisma.tenant.update({
            where: { id: state },
            data: {
                driveRefreshToken: tokens.refresh_token || undefined,
                driveAccessToken: tokens.access_token || undefined,
                driveTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                driveEmail,
                driveRootFolderId: rootFolderId,
            },
        });

        return NextResponse.redirect(`${baseUrl}/admin/settings?drive=connected`);
    } catch (e) {
        console.error('Drive callback error:', e);
        return NextResponse.redirect(`${baseUrl}/admin/settings?drive=error`);
    }
}
