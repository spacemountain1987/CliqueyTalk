
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const [clientId, appUrl] = await Promise.all([
        getLatestSecret('TWITCH_CLIENT_ID'),
        getLatestSecret('NEXT_PUBLIC_APP_URL')
    ]);

    const redirectUri = `${appUrl.trim()}/api/auth/twitch/callback`;

    const scopes = ['channel:read:redemptions', 'channel:manage:redemptions', 'user:read:email', 'moderation:read', 'channel:read:subscriptions'].join(' ');

    const state = randomUUID();

    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    const res = NextResponse.redirect(authUrl);
    res.cookies.set('twitch_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });
    return res;
  } catch (error) {
    console.error('An unexpected error occurred during Twitch authentication setup:', error);
    if (error instanceof Error && error.message.includes('Secret Manager')) {
        return new Response('Internal Server Error: Could not load critical application configuration from Secret Manager. Please verify that TWITCH_CLIENT_ID and NEXT_PUBLIC_APP_URL secrets exist and are accessible.', { status: 500 });
    }
    return new Response('An unexpected error occurred.', { status: 500 });
  }
}
