
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const clientId = await getLatestSecret('TWITCH_CLIENT_ID');
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).trim();
    const redirectUri = `${appUrl}/api/auth/twitch/callback`;

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
    if (error instanceof Error) {
      return new Response(
        `Twitch OAuth is not configured. ${error.message}`,
        { status: 503 }
      );
    }
    return new Response('Twitch OAuth is not configured.', { status: 503 });
  }
}
