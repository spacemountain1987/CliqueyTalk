
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireDiscordSession } from '@/lib/discord-session';
import { getLatestSecretCached } from '@/lib/secrets';
import { isValidSnowflake, isNonEmptyString } from '@/lib/discord-validators';

export async function GET(request: NextRequest) {
  try {
    await requireDiscordSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  let botToken: string;

  if (!channelId) {
    return NextResponse.json({ error: 'Channel ID is required.' }, { status: 400 });
  }

  if (!isValidSnowflake(channelId)) {
    return NextResponse.json({ error: 'Invalid Channel ID format. Expected a Discord snowflake ID.' }, { status: 400 });
  }

  try {
    botToken = await getLatestSecretCached('DISCORD_BOT_TOKEN');
  } catch {
    console.error("API Error: DISCORD_BOT_TOKEN is not configured.");
    return NextResponse.json(
      { error: 'Server is not configured for chat.' },
      { status: 500 }
    );
  }

  if (!isNonEmptyString(botToken)) {
    console.error('API Error: DISCORD_BOT_TOKEN resolved to an empty value.');
    return NextResponse.json(
      { error: 'Server is not configured for chat. Bot token is empty.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        // Revalidate every 5 seconds
        next: { revalidate: 5 },
      }
    );

    if (!response.ok) {
      const errorData = await response.text(); // Use .text() to avoid JSON parse error on empty body
      console.error('Failed to fetch messages from Discord. Status:', response.status, 'Body:', errorData);
      return NextResponse.json(
        {
          error: `Failed to fetch messages. Discord API responded with status ${response.status}.`,
        },
        { status: response.status }
      );
    }
    
    const messages = await response.json();
    return NextResponse.json(messages);

  } catch (error) {
    console.error('Error fetching messages from Discord:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
