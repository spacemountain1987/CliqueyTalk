
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { joinChannel, partChannel, getBotStatus } from '@/services/twitch-bot';
import { db } from '@/firebase/admin';
import { requireDiscordSession } from '@/lib/discord-session';
import { rateLimit } from '@/lib/rate-limit';

async function getAuthorizedTwitchChannelName(req: NextRequest): Promise<string> {
  const rl = rateLimit(req, { key: 'twitch-bot', capacity: 30, refillPerSecond: 0.5 });
  if (!rl.allowed) {
    throw new Error('Too many requests.');
  }

  const session = await requireDiscordSession(req);
  const { voiceChannelId } = await req.json();
  if (!voiceChannelId) {
    throw new Error('voiceChannelId is required.');
  }

  const channelDoc = await db.collection('voice_channels').doc(String(voiceChannelId)).get();
  if (!channelDoc.exists) {
    throw new Error('Voice channel not found.');
  }
  const data = channelDoc.data() as any;
  const participantIds: string[] = Array.isArray(data?.participantIds) ? data.participantIds : [];
  const creatorId: string | undefined = typeof data?.creatorId === 'string' ? data.creatorId : undefined;

  const isParticipant = creatorId === session.user.id || participantIds.includes(session.user.id);
  if (!isParticipant) {
    throw new Error('Forbidden.');
  }

  const twitchChannelName = typeof data?.twitchChannel === 'string' ? data.twitchChannel.trim() : '';
  if (!twitchChannelName) {
    throw new Error('No Twitch channel is configured for this voice channel.');
  }
  return twitchChannelName;
}

export async function GET(request: NextRequest) {
    try {
        const rl = rateLimit(request, { key: 'twitch-bot-status', capacity: 20, refillPerSecond: 0.2 });
        if (!rl.allowed) {
            return NextResponse.json(
                { message: 'Too many requests.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        try {
            await requireDiscordSession(request);
        } catch {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const status = await getBotStatus();
        return NextResponse.json(status);
    } catch (error: any) {
        return NextResponse.json({ message: `Error getting bot status: ${error.message}` }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
  try {
    const twitchChannelName = await getAuthorizedTwitchChannelName(request);
    await joinChannel(twitchChannelName);
    return NextResponse.json({ message: `Bot joining channel: ${twitchChannelName}` });
  } catch (error: any) {
    const status = error?.message === 'Forbidden.' ? 403 : 500;
    const message = error?.message === 'Too many requests.' ? 'Too many requests.' : `Failed to join channel: ${error.message}`;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
    try {
        const twitchChannelName = await getAuthorizedTwitchChannelName(request);
        await partChannel(twitchChannelName);
        return NextResponse.json({ message: `Bot has left channel: ${twitchChannelName}` });
    } catch (error: any) {
        const status = error?.message === 'Forbidden.' ? 403 : 500;
        const message = error?.message === 'Too many requests.' ? 'Too many requests.' : `Failed to part channel: ${error.message}`;
        return NextResponse.json({ message }, { status });
    }
}
