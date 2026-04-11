
'use server';

import { handleSongRequest } from '@/lib/song-request';
import { playNextSongInQueue } from '@/lib/audio-bot-actions';
import { getDiscordAccessTokenFromCookieStore, fetchDiscordUser } from '@/lib/discord-session';

export async function requestSongFromClient(songRequest: string, userId: string, requesterName: string) {
    if (!songRequest || !userId || !requesterName) {
        return { success: false, message: 'Missing required information.' };
    }

    // Verify the caller's identity via their Discord session cookie
    // to prevent spoofing song requests as other users.
    const accessToken = getDiscordAccessTokenFromCookieStore();
    if (!accessToken) {
        return { success: false, message: 'Not authenticated.' };
    }
    try {
        const discordUser = await fetchDiscordUser(accessToken);
        if (discordUser.id !== userId) {
            return { success: false, message: 'User identity mismatch.' };
        }
    } catch {
        return { success: false, message: 'Authentication failed.' };
    }

    return await handleSongRequest(songRequest, userId, requesterName);
}

export async function playNextSong() {
    await playNextSongInQueue();
}
