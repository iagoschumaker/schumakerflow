import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const IG_APP_ID = process.env.INSTAGRAM_APP_ID;
const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateRaw = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || !code || !stateRaw) {
        console.error('[IG Callback] Error:', error || 'Missing code/state');
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    let clientId: string;
    let source: string;
    try {
        const state = JSON.parse(Buffer.from(stateRaw, 'base64').toString('utf-8'));
        clientId = state.clientId;
        source = state.source || 'fb';
        if (!clientId) throw new Error('No clientId');
    } catch {
        console.error('[IG Callback] Invalid state:', stateRaw);
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    try {
        const redirectUri = `${BASE_URL}/api/portal/instagram/callback`;
        if (source === 'ig') {
            return await handleInstagramLogin(code, redirectUri, clientId);
        } else {
            return await handleFacebookLogin(code, redirectUri, clientId);
        }
    } catch (error) {
        console.error('[IG Callback] Error:', error);
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }
}

async function handleInstagramLogin(code: string, redirectUri: string, clientId: string) {
    if (!IG_APP_ID || !IG_APP_SECRET) {
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: IG_APP_ID, client_secret: IG_APP_SECRET,
            grant_type: 'authorization_code', redirect_uri: redirectUri, code,
        }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        console.error('[IG Login] Token failed:', tokenData);
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${tokenData.access_token}`);
    const longData = await longRes.json();
    const accessToken = longData.access_token || tokenData.access_token;

    const profileRes = await fetch(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${accessToken}`);
    const profileData = await profileRes.json();
    const igUserId = profileData.user_id || tokenData.user_id?.toString() || '';
    const igUsername = profileData.username || '';

    if (!igUserId) {
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    const existing = await (prisma as any).clientInstagram.findFirst({ where: { clientId, igUserId } });
    if (existing) {
        await (prisma as any).clientInstagram.update({ where: { id: existing.id }, data: { accessToken, username: igUsername } });
    } else {
        await (prisma as any).clientInstagram.create({ data: { clientId, accessToken, igUserId, username: igUsername } });
    }

    console.log(`[IG Login] Connected @${igUsername} for client ${clientId}`);
    return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=connected`);
}

async function handleFacebookLogin(code: string, redirectUri: string, clientId: string) {
    if (!FB_APP_ID || !FB_APP_SECRET) {
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FB_APP_SECRET}&code=${code}`);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        console.error('[FB Login] Token failed:', tokenData);
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=error`);
    }

    const longRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`);
    const longData = await longRes.json();
    const userToken = longData.access_token || tokenData.access_token;

    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`);
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=no_pages`);
    }

    let connectedCount = 0;
    for (const page of pagesData.data) {
        try {
            const igRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`);
            const igData = await igRes.json();

            if (igData.instagram_business_account) {
                const igAccount = igData.instagram_business_account;
                const existing = await (prisma as any).clientInstagram.findFirst({ where: { clientId, igUserId: igAccount.id } });
                if (existing) {
                    await (prisma as any).clientInstagram.update({ where: { id: existing.id }, data: { accessToken: page.access_token, username: igAccount.username || '' } });
                } else {
                    await (prisma as any).clientInstagram.create({ data: { clientId, accessToken: page.access_token, igUserId: igAccount.id, username: igAccount.username || '' } });
                }
                connectedCount++;
                console.log(`[FB Login] Connected @${igAccount.username} (page: ${page.name}) for client ${clientId}`);
            }
        } catch (err) {
            console.error(`[FB Login] Error checking page ${page.id}:`, err);
        }
    }

    if (connectedCount === 0) {
        return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=no_instagram`);
    }
    return NextResponse.redirect(`${BASE_URL}/portal/instagram?instagram=connected`);
}
