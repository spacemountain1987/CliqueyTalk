
import { config } from 'dotenv';
config(); // Load .env for credentials

import { db, storage } from './firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

async function setupTestEnvironment() {
  const testId = `test-${Date.now()}`;
  const channelId = `test-channel-${Date.now()}`;

  console.log(`

🚀 Setting up test environment with ID: ${testId}`);
  console.log('--------------------------------------------------');

  try {
    // 1. Create a placeholder user
    const creatorId = `test-user-${Date.now()}`;
    const userRef = db.collection('users').doc(creatorId);
    console.log(`1. Creating placeholder user: users/${creatorId}`);
    await userRef.set({
        displayName: 'Test Creator',
        username: 'Test Creator',
        profilePicture: 'https://cdn.discordapp.com/embed/avatars/0.png',
        isAdmin: true,
        createdAt: FieldValue.serverTimestamp(),
    });
    console.log('   ✅ User created.');

    // 2. Create a test voice channel document
    const voiceChannelRef = db.collection('voice_channels').doc(channelId);
    console.log(`
2. Creating voice channel: ${voiceChannelRef.path}`);
    await voiceChannelRef.set({
        name: `Test Channel: ${channelId}`,
        creatorId: creatorId,
        participantIds: [creatorId],
        type: 'voice',
        createdAt: FieldValue.serverTimestamp(),
        twitchChannel: 'cliqueytalk'
    });
    console.log('   ✅ Channel created.');

    // 3. Create the GLOBAL audioBot state document
    const audioBotStateRef = db.collection('app_settings').doc('audio_bot_state');
    console.log(`
3. Creating global audioBot state: ${audioBotStateRef.path}`);
    await audioBotStateRef.set({
        status: 'stopped',
        currentSongTitle: null,
        currentSongVideoId: null,
        requestedBy: null,
        lastTest: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('   ✅ AudioBot state created/updated.');

    // 4. Add a placeholder song to the GLOBAL queue
    const queueRef = db.collection('music_queue');
    console.log(`
4. Adding placeholder song to global queue: ${queueRef.path}`);
    await queueRef.add({
        title: 'Never Gonna Give You Up',
        videoId: 'dQw4w9WgXcQ',
        requestedBy: 'Test Creator',
        addedAt: FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Placeholder song added.');
    
    // 5. Create placeholder folders in Firebase Storage
    console.log(`
5. Creating placeholder folders in Firebase Storage...`);
    const bucket = storage.bucket();

    const createPlaceholder = async (folderName: string) => {
        const file = bucket.file(`${folderName}/.placeholder`);
        try {
            await file.save('', {
                contentType: 'application/octet-stream'
            });
            console.log(`   ✅ Created "${folderName}/" placeholder.`);
        } catch (e: any) {
            console.error(`   ❌ Failed to create "${folderName}/" folder.`);
            console.error(`   Error Code: ${e.code}`);
            console.error(`   Error Message: ${e.message}`);
            if (e.code === 403) {
                console.error(`
   👉 This is a permissions error (403 Forbidden). Please check the following:`);
                console.error(`      1. Go to the Google Cloud Console for project "${process.env.GCP_PROJECT || 'your-project-id'}".`);
                console.error(`      2. Navigate to IAM & Admin > IAM.`);
                console.error(`      3. Find the service account associated with your credentials (check your \`GOOGLE_APPLICATION_CREDENTIALS\` file).`);
                console.error(`      4. Ensure this service account has the "Storage Admin" (roles/storage.admin) role.`);
            }
            throw e; // Re-throw to fail the test
        }
    };

    await createPlaceholder('soundboard');
    await createPlaceholder('queued-songs');


    console.log('\\n--------------------------------------------------');
    console.log('🎉 Test Passed: Successfully populated the database and storage with test entities.');
    console.log(`   You can now join a channel in the app to see the results and check your Storage bucket.`);
    console.log(`   The test channel ID is: ${channelId}`);


  } catch (error: any) {
    // Catch block for the entire test setup
    console.log('\\n--------------------------------------------------');
    console.error('❌ Test Script Failed Overall.');
    console.log('\\n   👉  Troubleshooting Tips:');
    console.log('      - Review the specific error message above.');
    console.log('      - Ensure your Firebase Admin SDK credentials in .env are correct and the service account has the right permissions (e.g., Firestore User, Storage Admin).');
    console.log('      - Verify the project ID in your Firebase config is correct.');
    console.log('\\n--------------------------------------------------');
    process.exit(1);
  }
}

setupTestEnvironment();
