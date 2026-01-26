
'use server';

import { NextResponse } from 'next/server';
import { joinChannel, partChannel, getBotStatus } from '@/services/twitch-bot';

export async function GET(request: Request) {
    try {
        const status = await getBotStatus();
        return NextResponse.json(status);
    } catch (error: any) {
        return NextResponse.json({ message: `Error getting bot status: ${error.message}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
  try {
    const { channel } = await request.json();
    if (!channel) {
      return NextResponse.json({ message: 'Twitch channel name is required.' }, { status: 400 });
    }
    await joinChannel(channel);
    return NextResponse.json({ message: `Bot joining channel: ${channel}` });
  } catch (error: any) {
    return NextResponse.json({ message: `Failed to join channel: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    try {
        const { channel } = await request.json();
        if (!channel) {
          return NextResponse.json({ message: 'Twitch channel name is required.' }, { status: 400 });
        }
        await partChannel(channel);
        return NextResponse.json({ message: `Bot has left channel: ${channel}` });
    } catch (error: any) {
        return NextResponse.json({ message: `Failed to part channel: ${error.message}` }, { status: 500 });
    }
}
