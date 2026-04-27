
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireDiscordSession } from '@/lib/discord-session';
import { getLatestSecretCached } from '@/lib/secrets';
import { isNonEmptyString } from '@/lib/discord-validators';

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
      { error: 'Server is not configured for guild details.' },
      { status: 500 }
    );
  }

  if (!isNonEmptyString(guildId) || !isNonEmptyString(botToken)) {
    return NextResponse.json(
      { error: 'Server is not configured for guild details. Required secrets are empty.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        // Revalidate often during development, but could be longer in production
        next: { revalidate: 10 },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch guild details from Discord:', errorData);
      return NextResponse.json(
        {
          error: `Failed to fetch guild. Discord API error: ${errorData.message}`,
        },
        { status: response.status }
      );
    }
    
    const guild = await response.json();
    // Only return the fields we need to minimize data exposure
    return NextResponse.json({
        id: guild.id,
        name: guild.name,
        owner_id: guild.owner_id
    });

  } catch (error) {
    console.error('Error fetching guild details from Discord:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
