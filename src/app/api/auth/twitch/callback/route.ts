
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    return new Response('No code provided.', { status: 400 });
  }

  try {
    const [clientId, clientSecret, appUrl] = await Promise.all([
        getLatestSecret('TWITCH_CLIENT_ID'),
        getLatestSecret('TWITCH_CLIENT_SECRET'),
        getLatestSecret('NEXT_PUBLIC_APP_URL')
    ]);

    const redirectUri = `${appUrl.trim()}/api/auth/twitch/callback`;

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
    
    const dashboardUrl = new URL('/dashboard', appUrl.trim());
    dashboardUrl.searchParams.set('twitch_access_token', tokenData.access_token);
    
    return NextResponse.redirect(dashboardUrl);

  } catch (error) {
    console.error('An unexpected error occurred during Twitch authentication:', error);
    if (error instanceof Error && error.message.includes('Secret Manager')) {
        return new Response('Internal Server Error: Could not load critical application configuration from Secret Manager. Please verify that TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET secrets exist and are accessible.', { status: 500 });
    }
    return new Response('An unexpected error occurred.', { status: 500 });
  }
}
