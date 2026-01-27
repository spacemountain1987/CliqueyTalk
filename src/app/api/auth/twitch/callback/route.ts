
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code) {
    return new Response('No code provided.', { status: 400 });
  }

  const expectedState = req.cookies.get('twitch_oauth_state')?.value;
  if (!state || !expectedState || state !== expectedState) {
    return new Response('Authorization failed: Invalid state.', { status: 400 });
  }

  try {
    const [clientId, clientSecret] = await Promise.all([
      getLatestSecret('TWITCH_CLIENT_ID'),
      getLatestSecret('TWITCH_CLIENT_SECRET'),
    ]);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).trim();
    const redirectUri = `${appUrl}/api/auth/twitch/callback`;

    const params = new URLSearchParams();
    params.append('client_id', clientId.trim());
    params.append('client_secret', clientSecret.trim());
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: params,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return new Response(JSON.stringify(tokenData), { status: 500 });
    }

    const dashboardUrl = new URL('/dashboard', appUrl);
    const res = NextResponse.redirect(dashboardUrl);

    res.cookies.set('twitch_oauth_state', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    res.cookies.set('twitch_access_token', tokenData.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    });

    return res;

  } catch (error) {
    console.error('An unexpected error occurred during Twitch authentication:', error);
    if (error instanceof Error) {
      return new Response(
        `Twitch OAuth is not configured. ${error.message}`,
        { status: 503 }
      );
    }
    return new Response('Twitch OAuth is not configured.', { status: 503 });
  }
}
