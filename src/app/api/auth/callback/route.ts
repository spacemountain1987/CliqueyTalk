
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    return new Response('Authorization failed: No code provided.', { status: 400 });
  }

  try {
    const [clientId, clientSecret, appUrl] = await Promise.all([
        getLatestSecret('DISCORD_CLIENT_ID'),
        getLatestSecret('DISCORD_CLIENT_SECRET'),
        getLatestSecret('NEXT_PUBLIC_APP_URL')
    ]);
    
    const redirectUri = `${appUrl.trim()}/api/auth/callback`;

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
    
    const dashboardUrl = new URL('/dashboard', appUrl.trim());
    dashboardUrl.searchParams.set('access_token', tokenData.access_token);
    
    return NextResponse.redirect(dashboardUrl);

  } catch (error) {
    console.error('An unexpected error occurred during authentication:', error);
    if (error instanceof Error && error.message.includes('Secret Manager')) {
        return new Response('Internal Server Error: Could not load critical application configuration from Secret Manager. Please verify that DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET secrets exist and are accessible.', { status: 500 });
    }
    return new Response('An unexpected error occurred.', { status: 500 });
  }
}
