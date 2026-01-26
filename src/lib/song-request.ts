
'use server';

import { db } from '@/firebase/admin';
import { processSongRequest } from '@/lib/audio-bot-actions';

interface SongRequestResult {
    success: boolean;
    message: string;
}

export async function handleSongRequest(songRequest: string, userId: string, requesterName: string): Promise<SongRequestResult> {
    try {
        // The logic is now centralized, we just need to pass the request on.
        // No need to find the specific channel the user is in.
        const result = await processSongRequest(songRequest, requesterName, userId);

        if (result.success) {
            return { success: true, message: `✅ ${result.message}` };
        } else {
            return { success: false, message: `❌ ${result.message}` };
        }
        
    } catch (error: any) {
        console.error('Error in handleSongRequest wrapper:', error);
        return { success: false, message: `An unexpected error occurred.` };
    }
}
