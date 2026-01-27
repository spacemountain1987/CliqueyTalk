'use server';

import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/firebase/admin';
import { randomUUID } from 'crypto';
import { requireDiscordSession } from '@/lib/discord-session';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_DESTINATIONS = ['soundboard', 'queued-songs'] as const;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
]);

export async function POST(req: NextRequest) {
  console.log('Generate Signed URL API: Received request.');
  try {
    const rl = rateLimit(req, { key: 'upload', capacity: 20, refillPerSecond: 0.2 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    // Require a valid Discord session cookie. This also implicitly makes the endpoint same-origin.
    await requireDiscordSession(req);

    const contentTypeHeader = req.headers.get('content-type') || '';

    // Mode A: multipart/form-data (server uploads file) — used by voice-channel queued-song uploads.
    if (contentTypeHeader.toLowerCase().includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const destination = String(form.get('destination') || '');

      if (!destination || !ALLOWED_DESTINATIONS.includes(destination as any)) {
        return NextResponse.json({ error: 'Invalid destination folder.' }, { status: 400 });
      }

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
      }

      const fileType = file.type || 'application/octet-stream';
      if (!ALLOWED_AUDIO_TYPES.has(fileType)) {
        return NextResponse.json({ error: 'Invalid file type.' }, { status: 400 });
      }

      const safeFileName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '');
      const uniqueFileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeFileName}`;
      const storagePath = `${destination}/${uniqueFileName}`;

      const bucket = storage.bucket();
      const gcsFile = bucket.file(storagePath);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await gcsFile.save(buffer, {
        resumable: false,
        contentType: fileType,
        metadata: {
          cacheControl: 'no-store',
        },
      });

      return NextResponse.json({ success: true, storagePath });
    }

    // Mode B: JSON (mint signed URL) — used by soundboard uploads.
    const { name, contentType, destination } = await req.json();

    if (!name || !contentType) {
      return NextResponse.json({ error: 'Missing name or contentType.' }, { status: 400 });
    }
    
    if (!destination || !ALLOWED_DESTINATIONS.includes(destination)) {
      console.log(`Generate Signed URL API: Error - Invalid destination: ${destination}`);
      return NextResponse.json({ error: 'Invalid destination folder.' }, { status: 400 });
    }

    if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Invalid content type.' }, { status: 400 });
    }

    console.log(`Generate Signed URL API: Processing request for file '${name}' of type '${contentType}' for destination '${destination}'.`);
    
    const safeFileName = name.replace(/[^a-zA-Z0-9._-]/g, '');
    const uniqueFileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeFileName}`;
    const storagePath = `${destination}/${uniqueFileName}`;

    console.log(`Generate Signed URL API: Generating signed URL for path: ${storagePath}`);
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    const options = {
      version: 'v4' as 'v4',
      action: 'write' as 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    };

    const [signedUrl] = await file.getSignedUrl(options);

    console.log('Generate Signed URL API: URL generated successfully.');
    return NextResponse.json({ success: true, signedUrl, storagePath });

  } catch (error: any) {
    console.error('Generate Signed URL API: Full error object:', error);
    const errorMessage = error.message || 'An unknown error occurred during signed URL generation.';
    return NextResponse.json({ error: `Signed URL API failed: ${errorMessage}` }, { status: 500 });
  }
}
