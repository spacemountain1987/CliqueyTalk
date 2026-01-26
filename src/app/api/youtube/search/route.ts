
import { NextRequest, NextResponse } from 'next/server';
import Innertube from 'youtubei.js';
import { requireDiscordSession } from '@/lib/discord-session';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { key: 'youtube-search', capacity: 20, refillPerSecond: 0.2 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    await requireDiscordSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const youtube = await Innertube.create();
    const search = await youtube.search(query, { sort_by: 'relevance', type: 'video' });

    if (search.videos.length > 0) {
      const results = search.videos.slice(0, 10).map(item => ({
        videoId: item.id,
        title: item.title.text,
        channel: item.author.name,
      }));
      return NextResponse.json(results);
    } else {
      return NextResponse.json({ error: 'No results found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error searching YouTube with youtubei.js:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred while searching YouTube.' }, { status: 500 });
  }
}
