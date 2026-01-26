
import { NextResponse } from 'next/server';
import Innertube from 'youtubei.js';
import { getLatestSecret } from '@/lib/secrets';
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { requireFirebaseIdToken } from '@/lib/firebase-id-token';

const secretId = 'YOUTUBE_COOKIE';

// GET: Test the current cookie
export async function GET(req: NextRequest) {
    const rl = rateLimit(req, { key: 'youtube-cookie-manager', capacity: 10, refillPerSecond: 0.1 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many requests.' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
        );
    }

    try {
        const decoded = await requireFirebaseIdToken(req);
        if (!decoded.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 });
    }

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
