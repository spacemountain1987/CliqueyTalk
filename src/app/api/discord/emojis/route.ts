
import { NextResponse } from 'next/server';

export async function GET() {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !botToken) {
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
