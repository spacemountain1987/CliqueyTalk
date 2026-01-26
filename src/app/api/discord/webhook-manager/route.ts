
import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseIdToken } from '@/lib/firebase-id-token';

const BOT_USER_AGENT = 'DiscordBot (CliqueyTalk, 1.0)';

// POST: Create a webhook for a given channel
export async function POST(request: NextRequest) {
  try {
    const decoded = await requireFirebaseIdToken(request);
    if (!decoded.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'Server is not configured with a bot token.' }, { status: 500 });
  }

  try {
    const { channelId } = await request.json();
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required.' }, { status: 400 });
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
        'User-Agent': BOT_USER_AGENT,
      },
      body: JSON.stringify({
        name: 'CliqueyTalk Mod Chat',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create webhook:', errorData);
      return NextResponse.json({ error: `Discord API Error: ${errorData.message || 'Unknown error'}` }, { status: response.status });
    }

    const webhook = await response.json();
    return NextResponse.json({ webhook });

  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// DELETE: Delete a webhook by its ID
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireFirebaseIdToken(request);
    if (!decoded.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'Server is not configured with a bot token.' }, { status: 500 });
  }

  try {
    const { webhookId } = await request.json();
    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID is required.' }, { status: 400 });
    }

    const response = await fetch(`https://discord.com/api/v10/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'User-Agent': BOT_USER_AGENT,
      },
    });

    if (response.status === 204) {
      return NextResponse.json({ message: 'Webhook deleted successfully.' });
    }

    // Handle cases where webhook might already be deleted (404) gracefully
    if (response.status === 404) {
      return NextResponse.json({ message: 'Webhook not found, may have already been deleted.' }, { status: 200 });
    }

    const errorData = await response.json();
    console.error('Failed to delete webhook:', errorData);
    return NextResponse.json({ error: `Discord API Error: ${errorData.message || 'Unknown error'}` }, { status: response.status });
    
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
