
// To run this test from your terminal:
// npx tsx src/youtube-test.ts "your song name here"

import { config } from 'dotenv';
config(); // Load environment variables from a .env file if you have one

import Innertube from 'youtubei.js';

async function testYouTubeSearch() {
  const query = process.argv[2];

  if (!query) {
    console.error('❌ Please provide a song name to search for.');
    console.log('Usage: npx tsx src/youtube-test.ts "your song name here"');
    process.exit(1);
  }

  console.log(`\n🔍 Searching YouTube for: "${query}"...\n`);
  
  try {
    const youtube = await Innertube.create();
    const search = await youtube.search(query, { sort_by: 'relevance', type: 'video' });
    const topResult = search.videos[0];

    if (topResult) {
      console.log('✅ Success! Song found.');
      console.log(`   Title: ${topResult.title.text}`);
      console.log(`   Video ID: ${topResult.id}`);
      
      console.log('\nAttempting to fetch audio stream info...');
      const stream = await youtube.download(topResult.id, {
          type: 'audio',
          quality: 'best',
      });
      console.log('✅ Success! Audio stream is available for this video.');
      // In a real app, you would now use this 'stream' (a ReadableStream)
      
    } else {
      console.log('🟡 No results found for your query.');
    }
  } catch (error: any) {
    console.error('❌ API call failed. Details below:\n');
    console.error(error.message);
    console.log('\n💡 HINT: This might be due to network issues or changes in the YouTube API that youtubei.js has not yet adapted to.');
  }
}

testYouTubeSearch();
