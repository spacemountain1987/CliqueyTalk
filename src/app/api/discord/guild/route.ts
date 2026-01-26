
import { NextResponse } from 'next/server';

export async function GET() {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !botToken) {
    return NextResponse.json(
      { error: 'Server is not configured for guild details.' },
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
