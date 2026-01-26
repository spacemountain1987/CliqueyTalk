
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code) {
    return new Response('Authorization failed: No code provided.', { status: 400 });
  }

  const expectedState = req.cookies.get('discord_oauth_state')?.value;
  if (!state || !expectedState || state !== expectedState) {
    return new Response('Authorization failed: Invalid state.', { status: 400 });
  }

  try {
    const [clientId, clientSecret] = await Promise.all([
      getLatestSecret('DISCORD_CLIENT_ID'),
      getLatestSecret('DISCORD_CLIENT_SECRET'),
    ]);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).trim();
    const redirectUri = `${appUrl}/api/auth/callback`;

    const params = new URLSearchParams();
    params.append('client_id', clientId.trim());
    params.append('client_secret', clientSecret.trim());
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error('Failed to fetch access token:', tokenData);
        return new Response(`Failed to fetch access token: ${tokenData.error_description || 'Unknown error'}`, { status: 500 });
    }

    const dashboardUrl = new URL('/dashboard', appUrl);
    const res = NextResponse.redirect(dashboardUrl);

    // Clear state cookie after use
    res.cookies.set('discord_oauth_state', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    // Store the access token server-side in an httpOnly cookie.
    res.cookies.set('discord_access_token', tokenData.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // Discord access tokens are short-lived; keep cookie short.
      maxAge: 60 * 60, // 1 hour
    });

    return res;

  } catch (error) {
    console.error('An unexpected error occurred during authentication:', error);
    if (error instanceof Error) {
      return new Response(
        `Discord OAuth is not configured. ${error.message}`,
        { status: 503 }
      );
    }
    return new Response('Discord OAuth is not configured.', { status: 503 });
  }
}
