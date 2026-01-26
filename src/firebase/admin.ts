
import * as admin from 'firebase-admin';

// In a Google Cloud environment like App Hosting, the SDK can automatically
// discover the project configuration, including the Project ID and storage bucket.
// Calling initializeApp() with no arguments is the standard and correct approach.
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized successfully using Application Default Credentials.');
  } catch (error: any) {
    console.error("CRITICAL: Firebase Admin SDK initialization failed.", error);
    // This is a fatal error and the application will not work without it.
  }
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

export { db, auth, storage };
