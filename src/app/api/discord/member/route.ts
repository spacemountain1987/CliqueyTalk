
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { requireDiscordSession } from '@/lib/discord-session';

export async function GET(request: NextRequest) {
  try {
    await requireDiscordSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  if (!guildId || !botToken) {
    return NextResponse.json(
      { error: 'Server is not configured to fetch member details.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        // Revalidate often, as roles can change
        next: { revalidate: 10 }, 
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to fetch member from Discord:', errorData);
      return NextResponse.json(
        {
          error: `Failed to fetch member. Discord API error: ${errorData.message || 'Unknown error'}`,
        },
        { status: response.status }
      );
    }
    
    const member = await response.json();
    return NextResponse.json(member);

  } catch (error) {
    console.error('Error fetching member from Discord:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching member details.' },
      { status: 500 }
    );
  }
}
