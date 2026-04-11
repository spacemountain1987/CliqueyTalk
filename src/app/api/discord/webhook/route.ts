
import { NextRequest, NextResponse } from 'next/server';
import { requireFirebaseIdToken } from '@/lib/firebase-id-token';
import { isValidDiscordWebhookUrl } from '@/lib/discord-validators';

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireFirebaseIdToken(request);
    if (!decoded.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content, username, avatar_url, webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing required field: webhookUrl' },
        { status: 400 }
      );
    }

    if (typeof webhookUrl !== 'string' || !isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        { error: 'Invalid webhookUrl. Must be a valid Discord webhook URL (https://discord.com/api/webhooks/...).' },
        { status: 400 }
      );
    }
    
    if (!content || !username) {
      return NextResponse.json({ error: 'Missing required fields: content, username' }, { status: 400 });
    }

    const payload = {
      content: content,
      username: username,
      avatar_url: avatar_url,
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        // Discord returns error details in the body, so log them
        const errorData = await response.json();
        console.error('Failed to send webhook message to Discord:', errorData);
        return NextResponse.json(
            { error: `Discord API error: ${errorData.message || 'Unknown error'}` },
            { status: response.status }
        );
    }
    
    // Discord returns a 204 No Content on success, so we'll return our own success message.
    return NextResponse.json({ message: 'Message sent successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error processing webhook request:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
