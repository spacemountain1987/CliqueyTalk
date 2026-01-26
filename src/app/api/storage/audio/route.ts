
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/firebase/admin';
import { requireDiscordSession } from '@/lib/discord-session';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_PREFIXES = ['queued-songs/', 'soundboard/'];

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { key: 'storage-audio', capacity: 60, refillPerSecond: 1 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response('Invalid or missing storage path', { status: 400 });
  }

  // Require a valid Discord session cookie to prevent unauthenticated hotlinking.
  try {
    await requireDiscordSession(request);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  // Prevent arbitrary bucket reads.
  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return new Response('Invalid storage path', { status: 400 });
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
