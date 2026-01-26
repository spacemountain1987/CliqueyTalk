
import { NextRequest, NextResponse } from 'next/server';

/**
 * A generic proxy for making authenticated requests to the Discord API.
 * It takes a `ds-path` header for the Discord API path (e.g., /users/@me)
 * and forwards the request using the user's access token from the Authorization header.
 */
export async function GET(req: NextRequest) {
  const discordApiPath = req.headers.get('ds-path');
  const userAccessToken = req.headers.get('Authorization');

  if (!discordApiPath) {
    return NextResponse.json({ error: 'Missing ds-path header' }, { status: 400 });
  }

  if (!userAccessToken) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  try {
    const discordApiUrl = `https://discord.com/api/v10${discordApiPath}`;

    const response = await fetch(discordApiUrl, {
      headers: {
        'Authorization': userAccessToken,
      },
       next: { revalidate: 10 }, // Revalidate often
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Proxy Error: Failed to fetch from Discord API path: ${discordApiPath}`, errorData);
      return NextResponse.json(
        { error: `Discord API Error: ${errorData.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error(`Proxy Error: Unexpected error for path: ${discordApiPath}`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  const discordApiPath = req.headers.get('ds-path');
  const botToken = process.env.DISCORD_BOT_TOKEN;
  
  if (!discordApiPath) {
    return NextResponse.json({ error: 'Missing ds-path header' }, { status: 400 });
  }

  if (!botToken) {
    return NextResponse.json({ error: 'Server is not configured with a bot token.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const discordApiUrl = `https://discord.com/api/v10${discordApiPath}`;

    const response = await fetch(discordApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Proxy POST Error: Failed to post to Discord API path: ${discordApiPath}`, errorData);
      return NextResponse.json(
        { error: `Discord API Error: ${errorData.message || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Proxy POST Error: Unexpected error for path: ${discordApiPath}`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
