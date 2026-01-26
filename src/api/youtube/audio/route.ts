
import { NextRequest } from 'next/server';
import Innertube from 'youtubei.js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const youtubeCookie = process.env.YOUTUBE_COOKIE;

  if (!videoId) {
    return new Response('Invalid or missing Video ID', { status: 400 });
  }

  if (!youtubeCookie) {
    return new Response('YouTube cookie is not configured on the server.', { status: 500 });
  }

  try {
    // Initialize client and set cookie separately for robustness in different environments.
    const youtube = await Innertube.create();
    youtube.session.cookie = youtubeCookie;

    const stream = await youtube.download(videoId, {
      type: 'audio',
      quality: 'best',
    });
    
    // To increase reliability in serverless environments, we buffer the entire stream
    // on the server before sending it to the client.
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        // The 'best' audio quality from YouTube is typically in a webm container.
        'Content-Type': 'audio/webm',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-cache',
      },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[${videoId}] Failed to stream audio:`, error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to retrieve audio stream.' }), { status: 500 });
  }
}
