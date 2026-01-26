
import { NextRequest, NextResponse } from 'next/server';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      throw new Error('Server configuration error: NEXT_PUBLIC_APP_URL is not defined.');
    }

    const clientId = await getLatestSecret('TWITCH_CLIENT_ID');
    const redirectUri = `${appUrl.trim()}/api/auth/twitch/callback`;
    const scopes = ['channel:read:redemptions', 'channel:manage:redemptions', 'user:read:email', 'moderation:read', 'channel:read:subscriptions'].join(' ');

    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('An unexpected error occurred during Twitch authentication setup:', error);
    if (error instanceof Error) {
        if (error.message.includes('Secret Manager')) {
            return new Response('Internal Server Error: Could not load critical application configuration from Secret Manager. Please verify that the TWITCH_CLIENT_ID secret exists and is accessible.', { status: 500 });
        }
        if (error.message.includes('NEXT_PUBLIC_APP_URL')) {
            return new Response('Internal Server Error: Application URL is not configured on the server.', { status: 500 });
        }
    }
    return new Response('An unexpected error occurred.', { status: 500 });
  }
}
