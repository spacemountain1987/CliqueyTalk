
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const clientId = await getLatestSecret('DISCORD_CLIENT_ID');
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).trim();
    const redirectUri = `${appUrl}/api/auth/callback`;

    const scopes = ['identify', 'email', 'guilds'].join(' ');

    const state = randomUUID();

    const authUrl = new URL('https://discord.com/api/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    const res = NextResponse.redirect(authUrl);
    res.cookies.set('discord_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    });
    return res;
  } catch (error) {
    console.error('An unexpected error occurred during Discord authentication setup:', error);
    if (error instanceof Error) {
      return new Response(
        `Discord OAuth is not configured. ${error.message}`,
        { status: 503 }
      );
    }
    return new Response('Discord OAuth is not configured.', { status: 503 });
  }
}
