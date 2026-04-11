
'use server';

import tmi from 'tmi.js';
import { db } from '@/firebase/admin';
import { processSongRequest } from '@/lib/audio-bot-actions';
import { getLatestSecretCached } from '@/lib/secrets';

let client: tmi.Client | null = null;
let isConnecting = false;
let connectedChannels = new Set<string>();

interface BotStatus {
    isConnected: boolean;
    channels: string[];
}

async function getValidAccessToken(): Promise<string> {
    const credsRef = db.collection('app_settings').doc('twitch_bot_credentials');
    const credsDoc = await credsRef.get();

    if (!credsDoc.exists) {
        throw new Error('Twitch account not connected. Please connect via the admin panel.');
    }

    const credentials = credsDoc.data()!;
    // Refresh if token expires in the next minute
    if (Date.now() + 60000 > credentials.expiresAt) {
        console.log('Refreshing Twitch token...');
        const [clientId, clientSecret] = await Promise.all([
            getLatestSecretCached('TWITCH_CLIENT_ID'),
            getLatestSecretCached('TWITCH_CLIENT_SECRET'),
        ]);

        const params = new URLSearchParams({
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            grant_type: 'refresh_token',
            refresh_token: credentials.refreshToken,
        });

        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const tokenData = await response.json();
        if (!response.ok) {
            await credsRef.delete();
            throw new Error(`Failed to refresh token: ${tokenData.message}. Please re-authorize from the admin panel.`);
        }

        const newCredentials = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
        };

        await credsRef.set(newCredentials);
        console.log('Successfully refreshed and stored new Twitch token.');
        return newCredentials.accessToken;
    }
    
    return credentials.accessToken;
}

async function initializeBot() {
    if (client || isConnecting) return;
    isConnecting = true;

    try {
        const oauth_token = await getValidAccessToken();
        
        const validationResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: { 'Authorization': `OAuth ${oauth_token}` }
        });
        if (!validationResponse.ok) {
            const errorText = await validationResponse.text();
            throw new Error(`Failed to validate Twitch token. Status: ${validationResponse.status}, Body: ${errorText}`);
        }
        const validationData = await validationResponse.json();
        const botUsername = validationData.login;

        if (!botUsername) {
            throw new Error('Could not determine bot username from Twitch token.');
        }
        
        const newClient = new tmi.Client({
            options: { debug: process.env.NODE_ENV === 'development' },
            identity: { username: botUsername, password: `oauth:${oauth_token}` },
        });

        newClient.on('message', async (channel, tags, message, self) => {
            if(self) return;

            const requester = tags['display-name'] || 'Someone';

            // !sr command
            if (message.toLowerCase().startsWith('!sr ')) {
                const request = message.substring(4).trim();
                if (!request) return;

                try {
                    // With the global queue, we no longer need to find the specific CliqueyTalk channel.
                    // We just add the song to the one-and-only queue.
                    const result = await processSongRequest(request, requester);

                    if (result.success) {
                        const successMessage = result.message.replace('queued up', 'Queued up'); 
                        newClient.say(channel, `@${requester}, ${successMessage}.`);
                    } else {
                        newClient.say(channel, `@${requester}, sorry, an error occurred: ${result.message}`);
                    }

                } catch (error: any) {
                    console.error('Error during Twitch song request:', error);
                    newClient.say(channel, `@${requester}, sorry, an internal server error occurred.`);
                }
                return;
            }

            // !oops command — only lets the requester remove their own last song
            if (message.toLowerCase() === '!oops') {
                try {
                    const queueRef = db.collection('music_queue');
                    // Find the most recent song added by this specific requester.
                    const lastSongQuery = queueRef
                        .where('requestedBy', '==', requester)
                        .orderBy('addedAt', 'desc')
                        .limit(1);
                    const lastSongSnapshot = await lastSongQuery.get();

                    if (!lastSongSnapshot.empty) {
                        const songToRemoveDoc = lastSongSnapshot.docs[0];
                        const removedSongTitle = songToRemoveDoc.data().title;
                        await songToRemoveDoc.ref.delete();
                        newClient.say(channel, `@${requester}, removed your last song from the queue: "${removedSongTitle}".`);
                    } else {
                        newClient.say(channel, `@${requester}, you don't have any songs in the queue.`);
                    }
                } catch (error) {
                    console.error('Error during Twitch !oops command:', error);
                    newClient.say(channel, `@${requester}, sorry, an internal server error occurred while trying to remove the last song.`);
                }
                return;
            }
        });

        newClient.on('connected', (address, port) => console.log(`Twitch bot connected to ${address}:${port}`));
        newClient.on('disconnected', (reason) => {
            console.log(`Twitch bot disconnected: ${reason}`);
            client = null;
            connectedChannels.clear();
        });

        await newClient.connect();
        client = newClient;
    } catch (error) {
        console.error("Failed to initialize Twitch bot:", error);
        client = null;
    } finally {
        isConnecting = false;
    }
}

export async function joinChannel(channel: string) {
    if (!client && !isConnecting) {
        await initializeBot();
    }
    
    let maxWait = 100; // Wait for max 10 seconds
    while (isConnecting && maxWait > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        maxWait--;
    }

    if (client && !connectedChannels.has(channel)) {
        try {
            await client.join(channel);
            connectedChannels.add(channel);
            console.log(`Bot joined channel: ${channel}`);
        } catch (error) {
            console.error(`Failed to join channel ${channel}:`, error);
        }
    }
}

export async function partChannel(channel: string) {
    if (client && connectedChannels.has(channel)) {
         try {
            await client.part(channel);
            connectedChannels.delete(channel);
            console.log(`Bot left channel: ${channel}`);
        } catch (error) {
            console.error(`Failed to part channel ${channel}:`, error);
        }
    }
}

export async function getBotStatus(): Promise<BotStatus> {
    return {
        isConnected: !!client && client.readyState() === 'OPEN',
        channels: Array.from(connectedChannels),
    };
}
