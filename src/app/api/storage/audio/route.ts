
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/firebase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response('Invalid or missing storage path', { status: 400 });
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(path);

    const [exists] = await file.getMetadata().catch(() => [false]);
    if (!exists) {
        return new Response('File not found in storage.', { status: 404 });
    }
    
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'audio/mpeg';

    // Get a readable stream for the file and pass it directly to the response
    const stream = file.createReadStream();

    return new Response(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[Storage Proxy] Failed to stream audio for path ${path}:`, error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to retrieve audio stream.' }), { status: 500 });
  }
}
