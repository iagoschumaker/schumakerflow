import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, ApiContext } from '@/lib/api/helpers';

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const IG_APP_ID = process.env.INSTAGRAM_APP_ID;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// GET /api/portal/instagram/connect?source=fb|ig
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const source = new URL(req.url).searchParams.get('source') || 'fb';
        const redirectUri = `${BASE_URL}/api/portal/instagram/callback`;

        const state = JSON.stringify({
            tenantId: ctx.tenantId,
            clientId: ctx.clientId,
            source,
        });
        const stateEncoded = Buffer.from(state).toString('base64');

        if (source === 'ig') {
            if (!IG_APP_ID) return apiError('Instagram App não configurado.', 500);
            const scopes = ['instagram_business_basic', 'instagram_business_content_publish'].join(',');
            const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${IG_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${stateEncoded}`;
            return NextResponse.redirect(authUrl);
        } else {
            if (!FB_APP_ID) return apiError('Facebook App não configurado.', 500);
            const scopes = ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'].join(',');
            const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${stateEncoded}`;
            return NextResponse.redirect(authUrl);
        }
    },
    { roles: ['CLIENT_USER'] }
);
