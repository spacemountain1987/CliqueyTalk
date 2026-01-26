
import { NextResponse } from 'next/server';
import { db, storage } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST() {
  try {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: 'queued-songs/' });
    
    const queueCol = db.collection('music_queue');
    const queueSnapshot = await queueCol.where('storagePath', '!=', null).get();
    const existingPaths = new Set(queueSnapshot.docs.map(doc => doc.data().storagePath));

    const filesToAdd = files.filter(file => {
      // Don't add placeholder files or files that are already in the queue
      const isDirectoryPlaceholder = file.name.endsWith('/');
      const isOurPlaceholder = file.name.endsWith('/.placeholder');
      const alreadyExists = existingPaths.has(file.name);

      return !isDirectoryPlaceholder && !isOurPlaceholder && !alreadyExists;
    });

    if (filesToAdd.length === 0) {
      return NextResponse.json({ message: 'Storage is already in sync with the queue. No new songs found.' });
    }

    const batch = db.batch();
    let count = 0;

    for (const file of filesToAdd) {
      // Basic title extraction from filename
      const fileName = file.name.split('/').pop() || 'Unknown Track';
      const title = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');

      const newSongRef = queueCol.doc();
      batch.set(newSongRef, {
        storagePath: file.name,
        title: title,
        requestedBy: 'Manual Upload',
        requesterId: 'system-manual',
        addedAt: FieldValue.serverTimestamp(),
      });
      count++;
    }

    await batch.commit();

    return NextResponse.json({ message: `Successfully added ${count} new song(s) from storage to the queue.` });

  } catch (error: any) {
    console.error('Error syncing storage queue:', error);
    return NextResponse.json({ error: error.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}
