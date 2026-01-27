
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { requireFirebaseIdToken } from '@/lib/firebase-id-token';
import { getLatestSecretCached } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

// Helper to post a message to a Discord channel
async function postToDiscord(channelId: string, message: object) {
  const botToken = await getLatestSecretCached('DISCORD_BOT_TOKEN');

  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const headers = {
    'Authorization': `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Error posting to Discord: ${response.status}`, errorBody);
    throw new Error('Failed to post message to Discord.');
  }

  return response.json();
}

// --- Main POST handler ---
export async function POST(req: NextRequest) {
  try {
    const decoded = await requireFirebaseIdToken(req);
    if (!decoded.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { channelId } = await req.json(); // This is the ID of the VOICE channel

    if (!channelId) {
      return NextResponse.json({ error: 'Voice Channel ID is required' }, { status: 400 });
    }

    const [channelDoc, settingsDoc] = await Promise.all([
        db.collection('voice_channels').doc(channelId).get(),
        db.collection('app_settings').doc('announcement_channel').get()
    ]);
    
    if (!channelDoc.exists) {
      return NextResponse.json({ error: 'Voice channel not found in database' }, { status: 404 });
    }
    
    const targetTextChannelId = settingsDoc.exists ? settingsDoc.data()?.channelId : null;
    if (!targetTextChannelId) {
        return NextResponse.json({ error: 'Announcement channel is not configured in admin settings.' }, { status: 400 });
    }

    const channelData = channelDoc.data()!;
    const participantCount = channelData.participantIds?.length || 0;

    const embed = {
      title: `🔊 ${channelData.name}`,
      description: `A new voice channel is open. Click the button below to see the controls.`,
      color: 0x5865F2, 
      fields: [
        { name: 'Participants', value: `${participantCount} online`, inline: true },
        { name: 'Privacy', value: channelData.privacy === 'private' ? '🔒 Private' : '🌐 Public', inline: true },
      ],
      footer: {
        text: `Channel ID: ${channelId}`,
      },
      timestamp: new Date().toISOString(),
    };

    const message = {
      embeds: [embed],
      components: [
        {
          type: 1, 
          components: [
            {
              type: 2, 
              style: 2, 
              label: 'Show Controls', 
              custom_id: `show_controls_${channelId}`, 
              emoji: { name: '⚙️' },
            },
          ],
        },
      ],
    };

    const discordResponse = await postToDiscord(targetTextChannelId, message);
    
    // Store the message ID so we can update the embed later if needed
    await channelDoc.ref.update({ discordMessageId: discordResponse.id });

    return NextResponse.json({ success: true, messageId: discordResponse.id });

  } catch (error: any) {
    console.error('Error in post-channel-embed:', error);
    return NextResponse.json({ error: error.message || 'An internal error occurred.' }, { status: 500 });
  }
}
