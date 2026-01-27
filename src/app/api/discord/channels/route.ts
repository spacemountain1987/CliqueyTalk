
import { NextRequest, NextResponse } from 'next/server';
import { requireDiscordSession } from '@/lib/discord-session';
import { getLatestSecretCached } from '@/lib/secrets';

const VIEW_CHANNEL_PERMISSION = BigInt(1 << 10);
const ADMINISTRATOR_PERMISSION = BigInt(1 << 3);

export async function GET(request: NextRequest) {
  try {
    await requireDiscordSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const channelType = searchParams.get('channelType'); // 'text' or 'voice'

  let guildId: string;
  let botToken: string;
  try {
    [guildId, botToken] = await Promise.all([
      getLatestSecretCached('DISCORD_GUILD_ID'),
      getLatestSecretCached('DISCORD_BOT_TOKEN'),
    ]);
  } catch {
    console.error("API Error: DISCORD_GUILD_ID or DISCORD_BOT_TOKEN is not configured.");
    return NextResponse.json(
      { error: 'Server is not configured to fetch channels. Required secrets are missing.' },
      { status: 500 }
    );
  }
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required for permission check.' }, { status: 400 });
  }

  let allowedTypes: number[] = [];
  if (channelType === 'text') {
    allowedTypes = [0, 11]; // Text, Private Thread
  } else if (channelType === 'voice') {
    allowedTypes = [2, 13]; // Voice, Stage
  } else {
    allowedTypes = [0, 2, 11, 13];
  }


  try {
    const [channelsResponse, memberResponse, rolesResponse, guildResponse] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${botToken}` },
        next: { revalidate: 10 },
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${botToken}` },
        next: { revalidate: 10 },
      }),
       fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${botToken}` },
        next: { revalidate: 10 },
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${botToken}` },
        next: { revalidate: 10 },
      }),
    ]);

    if (!channelsResponse.ok) throw new Error('Failed to fetch guild channels from Discord.');
    if (!rolesResponse.ok) throw new Error('Failed to fetch guild roles from Discord.');
    if (!guildResponse.ok) throw new Error('Failed to fetch guild details from Discord.');

    // A user might not be in the guild, which is a valid case.
    if (!memberResponse.ok) {
      console.warn(`Could not fetch member ${userId} from guild ${guildId}. They may not be a member.`);
      return NextResponse.json([]); // Not a member, can't see any channels.
    }
    
    const allChannelsForType = (await channelsResponse.json()).filter((ch: any) => allowedTypes.includes(ch.type));
    const member = await memberResponse.json();
    const allRoles = await rolesResponse.json();
    const guild = await guildResponse.json();

    const isOwner = guild.owner_id === userId;
    
    let isAdministrator = false;
    if (member.roles) {
      const memberRoleIds = new Set(member.roles);
      for (const role of allRoles) {
        if (memberRoleIds.has(role.id)) {
          if ((BigInt(role.permissions) & ADMINISTRATOR_PERMISSION) !== BigInt(0)) {
            isAdministrator = true;
            break;
          }
        }
      }
    }
    
    let visibleChannels;

    if (isOwner || isAdministrator) {
        // Admins and owners see all relevant channels of the requested type.
        visibleChannels = allChannelsForType;
    } else {
        const memberRoles = new Set(member.roles);
        memberRoles.add(guildId); // Include @everyone role which is the same as the guild ID

        visibleChannels = allChannelsForType.filter((channel: any) => {
            const overwrites = channel.permission_overwrites || [];
            const everyoneOverwrite = overwrites.find((o: any) => o.id === guildId);

            const isPublic = !everyoneOverwrite || (BigInt(everyoneOverwrite.deny) & VIEW_CHANNEL_PERMISSION) === BigInt(0);
            
            if (isPublic) {
                const isDeniedByRole = overwrites.some((o: any) => memberRoles.has(o.id) && (BigInt(o.deny) & VIEW_CHANNEL_PERMISSION) !== BigInt(0));
                return !isDeniedByRole;
            } else {
                const isAllowedByRole = overwrites.some((o: any) => memberRoles.has(o.id) && (BigInt(o.allow) & VIEW_CHANNEL_PERMISSION) !== BigInt(0));
                return isAllowedByRole;
            }
        });
    }

    const relevantChannels = visibleChannels.map((channel: any) => ({ 
      id: channel.id, 
      name: channel.name, 
      type: channel.type 
    }));

    return NextResponse.json(relevantChannels);

  } catch (error) {
    console.error('Error fetching or processing Discord channels:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching channels.' },
      { status: 500 }
    );
  }
}
