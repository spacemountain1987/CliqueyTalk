'use server';

import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/firebase/admin';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  console.log('Generate Signed URL API: Received request.');
  try {
    const { name, contentType, destination } = await req.json();

    if (!name || !contentType) {
      return NextResponse.json({ error: 'Missing name or contentType.' }, { status: 400 });
    }
    
    if (!destination || !['soundboard', 'queued-songs'].includes(destination)) {
      console.log(`Generate Signed URL API: Error - Invalid destination: ${destination}`);
      return NextResponse.json({ error: 'Invalid destination folder.' }, { status: 400 });
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
