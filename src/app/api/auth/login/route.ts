
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  try {
    const [clientId, appUrl] = await Promise.all([
        getLatestSecret('DISCORD_CLIENT_ID'),
        getLatestSecret('NEXT_PUBLIC_APP_URL')
    ]);

    const redirectUri = `${appUrl.trim()}/api/auth/callback`;

    const scopes = ['identify', 'email', 'guilds'].join(' ');

    const authUrl = new URL('https://discord.com/api/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('prompt', 'consent');

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('An unexpected error occurred during Discord authentication setup:', error);
    if (error instanceof Error && error.message.includes('Secret Manager')) {
        return new Response('Internal Server Error: Could not load critical application configuration from Secret Manager. Please verify that DISCORD_CLIENT_ID and NEXT_PUBLIC_APP_URL secrets exist and are accessible.', { status: 500 });
    }
    return new Response('An unexpected error occurred.', { status: 500 });
  }
}
