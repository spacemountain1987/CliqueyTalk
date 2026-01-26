
import { NextResponse } from 'next/server';
import Innertube from 'youtubei.js';

export async function GET(request: Request) {
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
