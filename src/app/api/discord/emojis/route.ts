
import { NextRequest, NextResponse } from 'next/server';
import { requireDiscordSession } from '@/lib/discord-session';
import { getLatestSecretCached } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  try {
    await requireDiscordSession(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let guildId: string;
  let botToken: string;
  try {
    [guildId, botToken] = await Promise.all([
      getLatestSecretCached('DISCORD_GUILD_ID'),
      getLatestSecretCached('DISCORD_BOT_TOKEN'),
    ]);
  } catch {
    return NextResponse.json(
      { error: 'Server is not configured to fetch emojis.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/emojis`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        next: { revalidate: 3600 }, // Emojis don't change often, revalidate every hour
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch emojis from Discord:', errorData);
      return NextResponse.json(
        {
          error: `Failed to fetch emojis. Discord API error: ${errorData.message || 'Unknown error'}`,
        },
        { status: response.status }
      );
    }
    
    const emojis = await response.json();
    return NextResponse.json(emojis);

  } catch (error) {
    console.error('Error fetching emojis from Discord:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching emojis.' },
      { status: 500 }
    );
  }
}
