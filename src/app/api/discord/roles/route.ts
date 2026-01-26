
import { NextResponse } from 'next/server';

export async function GET() {
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !botToken) {
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
