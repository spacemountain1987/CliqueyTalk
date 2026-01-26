
import { NextRequest, NextResponse } from 'next/server';
import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { db } from '@/firebase/admin';
import { handleSongRequest } from '@/lib/song-request';
import { FieldValue } from 'firebase-admin/firestore';

// --- Type Definitions for Firestore Documents ---
// These are duplicated from audio-bot-actions.ts to ensure type safety here.
interface AudioBotState {
    currentSongVideoId?: string | null;
    currentSongUrl?: string | null;
    currentSongTitle?: string | null;
    requestedBy?: string | null;
    requesterId?: string | null;
    status: 'playing' | 'stopped';
}

interface MusicQueueItem {
    videoId?: string;
    storagePath?: string;
    title: string;
    requestedBy: string;
    requesterId?: string;
    addedAt: FieldValue;
}

// The public key for verifying Discord interactions.
// Prefer configuration via env; keep a fallback to avoid breaking existing deployments.
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY
    || "6a903d0ec86d3d1556aeb2a7ec1dd585ab35e9129d040a8149cdfb8ad4154561";

// --- Main Interaction Handler ---
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();
  
  if (!signature || !timestamp || !rawBody) {
    return new NextResponse('Bad request signature', { status: 400 });
  }

  const isValid = verifyKey(
    rawBody,
    signature,
    timestamp,
    DISCORD_PUBLIC_KEY,
  );

  if (!isValid) {
    console.error('Invalid request signature');
    return new NextResponse('Invalid request signature', { status: 401 });
  }

  const interaction = JSON.parse(rawBody);
  const userId = interaction.member?.user?.id;

  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = interaction.data;

    if (custom_id.startsWith('update_settings_')) {
        // ... (This logic is unchanged and does not interact with the bot state)
    }

    if (custom_id.startsWith('request_song_modal_')) {
        const songRequestValue = components[0].components[0].value;
        const requester = interaction.member?.user?.global_name || interaction.member?.user?.username || 'Someone';

        if (!userId) {
            return NextResponse.json({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Could not identify user.', flags: 64 }});
        }
        
        const deferredResponse = NextResponse.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64 } });
        
        (async () => {
            const followUpUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
            const result = await handleSongRequest(songRequestValue, userId, requester);
            await fetch(followUpUrl, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ content: result.message })
            });
        })();
        
        return deferredResponse;
    }
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const { custom_id } = interaction.data;
    const channelId = custom_id.split('_').pop() || '';

    if (custom_id.startsWith('show_controls_')) {
      // ... (This logic is unchanged)
    }
    
    if (custom_id.startsWith('bot_controls_')) {
        const botStateRef = db.collection('app_settings').doc('audio_bot_state');
        const botStateDoc = await botStateRef.get();
        const botState = botStateDoc.data() as AudioBotState | undefined;
        
        let content;
        if (botStateDoc.exists && (botState?.currentSongUrl || botState?.currentSongVideoId)) {
            content = `🎶 **Now Playing:** ${botState?.currentSongTitle || 'Unknown Title'}\n*Requested by: ${botState?.requestedBy || 'Unknown'}*`;
        } else {
            content = '🤖 **Audio Bot Controls**\n\nThe queue is currently empty.';
        }

        return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: content,
                flags: 64,
                components: [
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 4, label: "⏹️ Stop Playback", custom_id: `stop_playback_${channelId}` },
                            { type: 2, style: 2, label: "↩️ Oops", custom_id: `oops_${channelId}` }
                        ]
                    }
                ]
            }
        });
    }

    if (custom_id.startsWith('oops_')) {
        const queueRef = db.collection('music_queue');
        const lastSongQuery = queueRef.orderBy('addedAt', 'desc').limit(1);
        const lastSongSnapshot = await lastSongQuery.get();

        let content;
        if (lastSongSnapshot.empty) {
            content = 'The song queue is empty.';
        } else {
            const lastSongDoc = lastSongSnapshot.docs[0];
            const songData = lastSongDoc.data() as MusicQueueItem;
            await lastSongDoc.ref.delete();
            content = `✅ Removed the last song from the queue: \"${songData.title}\"`;
        }
        
        return NextResponse.json({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: { content: content, components: interaction.message.components }
        });
    }
    
    if (custom_id.startsWith('add_song_')) {
        // ... (This logic is unchanged)
    }

    if (custom_id.startsWith('stop_playback_')) {
        const botStateRef = db.collection('app_settings').doc('audio_bot_state');
        const newState: AudioBotState = { 
            currentSongVideoId: null, 
            currentSongUrl: null, 
            currentSongTitle: null, 
            requestedBy: null, 
            requesterId: null,
            status: 'stopped' 
        };
        await botStateRef.set(newState, { merge: true });
        return NextResponse.json({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: '✅ Playback stopped.', components: [] } });
    }
    
    // ... (The rest of the component handlers are unchanged)
  }
  
  return new NextResponse('Unhandled interaction type', { status: 400 });
}
