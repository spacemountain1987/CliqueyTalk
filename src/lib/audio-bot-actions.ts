
'use server';

import { db, storage } from '@/firebase/admin';
import Innertube, { UniversalCache } from 'youtubei.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getLatestSecret } from '@/lib/secrets';

// --- Minimal, Safe Type Definitions for expected YouTube API responses ---
interface YouTubeVideo {
  id: string;
  title?: { text?: string; } | string;
}

interface YouTubePlaylist {
  info?: { title?: string; };
  videos?: {
    all: () => Promise<YouTubeVideo[]>;
  };
}

interface YouTubeSearch {
    videos: YouTubeVideo[];
}

// --- Type Definitions for Firestore Documents ---
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

interface ProcessSongResult {
    success: boolean;
    message: string;
}

// --- Robust Helper to extract a title from a YouTubeVideo object ---
function getYouTubeVideoTitle(video: YouTubeVideo): string {
    const title = video.title;
    if (typeof title === 'string') return title;
    if (typeof title?.text === 'string') return title.text;
    return 'Unknown Title';
}

export async function playNextSongInQueue() {
    const audioBotStateRef = db.collection('app_settings').doc('audio_bot_state');
    const queueRef = db.collection('music_queue');

    const nextSongQuery = queueRef.orderBy('addedAt', 'asc').limit(1);
    const nextSongs = await nextSongQuery.get();

    if (!nextSongs.empty) {
        const nextSongDoc = nextSongs.docs[0];
        const nextSong = nextSongDoc.data() as MusicQueueItem;
        
        const playbackBatch = db.batch();
        let newState: Partial<AudioBotState> = {
            currentSongTitle: nextSong.title,
            requestedBy: nextSong.requestedBy,
            requesterId: nextSong.requesterId || null,
            status: 'playing'
        };

        if (nextSong.storagePath) {
            const file = storage.bucket().file(nextSong.storagePath);
            const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
            newState.currentSongUrl = signedUrl;
            newState.currentSongVideoId = null;
        } else {
            newState.currentSongVideoId = nextSong.videoId || null;
            newState.currentSongUrl = null;
        }
        
        playbackBatch.set(audioBotStateRef, newState, { merge: true });
        playbackBatch.delete(nextSongDoc.ref);
        await playbackBatch.commit();
        return;
    }

    const backupPlaylistRef = db.collection('app_settings').doc('backup_playlist');
    const backupPlaylistDoc = await backupPlaylistRef.get();
    const playlistUrl = backupPlaylistDoc.exists ? backupPlaylistDoc.data()?.url : null;

    if (playlistUrl) {
        try {
            const youtubeCookie = await getLatestSecret('YOUTUBE_COOKIE');
            const youtube = await Innertube.create({ cookie: youtubeCookie, cache: new UniversalCache(false) });
            const playlist = await youtube.getPlaylist(playlistUrl) as unknown as YouTubePlaylist;

            if (playlist?.videos) {
                const videos = await playlist.videos.all();
                if (videos.length > 0) {
                    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
                    if (randomVideo?.id) {
                        await audioBotStateRef.set({
                            currentSongVideoId: randomVideo.id,
                            currentSongUrl: null,
                            currentSongTitle: getYouTubeVideoTitle(randomVideo),
                            requestedBy: 'Backup Playlist',
                            requesterId: 'system-backup',
                            status: 'playing',
                        }, { merge: true });
                        return;
                    }
                }
            }
        } catch (error) {
            console.error("Error processing backup playlist:", error);
        }
    }

    await audioBotStateRef.set({ currentSongVideoId: null, currentSongUrl: null, currentSongTitle: null, requestedBy: null, status: 'stopped' }, { merge: true });
}

export async function processSongRequest(songRequest: string, requesterName: string, requesterId?: string): Promise<ProcessSongResult> {
    const queueRef = db.collection('music_queue');
    const audioBotStateRef = db.collection('app_settings').doc('audio_bot_state');

    try {
        const youtubeCookie = await getLatestSecret('YOUTUBE_COOKIE');
        const youtube = await Innertube.create({ cookie: youtubeCookie, cache: new UniversalCache(false) });

        if (songRequest.includes('list=')) {
            try {
                const playlistId = new URL(songRequest).searchParams.get('list');
                if (playlistId) {
                    const playlist = await youtube.getPlaylist(playlistId) as unknown as YouTubePlaylist;
                    
                    if (!playlist?.videos) {
                        return { success: false, message: 'That playlist appears to be private or empty.' };
                    }

                    const videos = await playlist.videos.all();
                    if (videos.length === 0) {
                        return { success: false, message: 'That playlist is empty.' };
                    }

                    const batch = db.batch();
                    videos.forEach((video) => {
                        if (video?.id) {
                            const songData: Omit<MusicQueueItem, 'addedAt'> & { addedAt: FieldValue } = {
                                videoId: video.id,
                                title: getYouTubeVideoTitle(video),
                                requestedBy: requesterName,
                                requesterId: requesterId,
                                addedAt: FieldValue.serverTimestamp(),
                            };
                            const newSongRef = queueRef.doc();
                            batch.set(newSongRef, songData);
                        }
                    });
                    await batch.commit();
                    
                    const botStateDoc = await audioBotStateRef.get();
                    const botState = botStateDoc.data() as AudioBotState | undefined;
                    if (!botStateDoc.exists || botState?.status === 'stopped') {
                        await playNextSongInQueue();
                    }
                    const playlistTitle = playlist.info?.title || 'the playlist';
                    return { success: true, message: `Queued up ${videos.length} songs from "${playlistTitle}".`};
                }
            } catch (error) {
                 // Fall through to search instead.
            }
        }
        
        const search = await youtube.search(songRequest, { sort_by: 'relevance', type: 'video' }) as YouTubeSearch;
        if (!search.videos.length) {
             return { success: false, message: `I couldn't find a song matching "${songRequest}".` };
        }

        const topResult = search.videos[0];
        const songData: Omit<MusicQueueItem, 'addedAt'> & { addedAt: FieldValue } = {
            videoId: topResult.id,
            title: getYouTubeVideoTitle(topResult),
            requestedBy: requesterName,
            requesterId: requesterId,
            addedAt: FieldValue.serverTimestamp(),
        };
        await queueRef.add(songData);

        const botStateDoc = await audioBotStateRef.get();
        const botState = botStateDoc.data() as AudioBotState | undefined;
        if (!botStateDoc.exists || botState?.status === 'stopped') {
            await playNextSongInQueue();
        }
        
        return { success: true, message: `Queued up: "${songData.title}"` };

    } catch (error: any) {
        console.error('Error during song request processing:', error);
        let friendlyMessage = 'An internal error occurred while processing your song request.';
        if (error.message.includes('Secret Manager')) {
            friendlyMessage = 'The bot is not configured for song requests. Please contact an admin.';
        }
        return { success: false, message: friendlyMessage };
    }
}
