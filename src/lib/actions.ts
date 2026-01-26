
'use server';

import { revalidatePath } from 'next/cache';
import { handleSongRequest } from '@/lib/song-request';
import { playNextSongInQueue } from '@/lib/audio-bot-actions';

export async function requestSongFromClient(songRequest: string, userId: string, requesterName: string) {
    if (!songRequest || !userId || !requesterName) {
        return { success: false, message: 'Missing required information.' };
    }
    return await handleSongRequest(songRequest, userId, requesterName);
}

export async function playNextSong() {
    await playNextSongInQueue();
}
