
import { NextRequest, NextResponse } from 'next/server';
import Innertube from 'youtubei.js';
import { getLatestSecret } from '@/lib/secrets';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid or missing Video ID' }, { status: 400 });
  }

  try {
    const youtubeCookie = await getLatestSecret('YOUTUBE_COOKIE');
    
    const youtube = await Innertube.create();
    youtube.session.cookie = youtubeCookie;

    const stream = await youtube.download(videoId, {
      type: 'audio',
      quality: 'best',
    });
    
    // Stream the response directly to the client
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'audio/webm',
        'Cache-Control': 'no-cache',
      },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[YouTube Audio API Error] VideoID: ${videoId}. Full Error:`, error);
    let errorMessage = 'An unknown error occurred while fetching the YouTube audio stream.';
    if (error.message) {
        if (error.message.includes('login required') || error.message.includes('Authentication failed') || error.message.includes('YOUTUBE_COOKIE')) {
            errorMessage = 'The server could not access this video. The YOUTUBE_COOKIE secret is likely expired or invalid. Please update it in the admin panel.';
        } else {
            errorMessage = error.message;
        }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
