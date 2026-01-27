
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
      { error: 'Server is not configured to fetch roles.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        // Revalidate often during development, can be longer
        next: { revalidate: 10 }, 
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch roles from Discord:', errorData);
      return NextResponse.json(
        {
          error: `Failed to fetch roles. Discord API error: ${errorData.message}`,
        },
        { status: response.status }
      );
    }
    
    const roles = await response.json();
    return NextResponse.json(roles);

  } catch (error) {
    console.error('Error fetching roles from Discord:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
