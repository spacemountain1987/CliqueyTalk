
import { NextResponse } from 'next/server';
import Innertube from 'youtubei.js';
import { getLatestSecret } from '@/lib/secrets';

const secretId = 'YOUTUBE_COOKIE';

// GET: Test the current cookie
export async function GET() {
    try {
        const cookie = await getLatestSecret(secretId);
        const youtube = await Innertube.create({ cookie });
        // Use a known, highly available video for testing that doesn't require login.
        // The search itself is a good test of the cookie's validity for general API access.
        await youtube.search('rick astley never gonna give you up');
        return NextResponse.json({ status: 'valid' });
    } catch (error: any) {
        // youtubei.js often throws errors with messages containing 'login required'
        if (error.message.includes('login required') || error.message.includes('Authentication failed') || error.message.includes('YOUTUBE_COOKIE')) {
            return NextResponse.json({ status: 'stale', error: 'Login required. The cookie is likely expired or invalid.' });
        }
        console.error('YouTube cookie test failed with an unexpected error:', error.message);
        return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
    }
}
