/**
 * Simple test script to verify YouTube transcript extraction works
 * Run with: node test_youtube.js
 */

const { YoutubeTranscript } = require('youtube-transcript');

// Test URLs - replace with actual YouTube URLs you want to test
const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Example URL
    // Add more test URLs here
];

async function testYouTubeTranscript(url) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing URL: ${url}`);
    console.log('='.repeat(60));
    
    try {
        console.log('Fetching transcript...');
        const startTime = Date.now();
        
        const transcriptData = await YoutubeTranscript.fetchTranscript(url);
        
        const elapsed = Date.now() - startTime;
        
        if (!transcriptData || transcriptData.length === 0) {
            console.log('❌ FAILED: No transcript data returned');
            return false;
        }
        
        // Combine all transcript segments
        const fullText = transcriptData.map(item => item.text).join(' ').trim();
        
        console.log('✅ SUCCESS!');
        console.log(`   - Segments: ${transcriptData.length}`);
        console.log(`   - Total characters: ${fullText.length}`);
        console.log(`   - Time taken: ${elapsed}ms`);
        console.log(`   - First 200 chars: ${fullText.substring(0, 200)}...`);
        
        return true;
        
    } catch (err) {
        console.log('❌ FAILED with error:');
        console.log(`   - Error message: ${err.message}`);
        
        // Provide helpful diagnostics
        if (err.message.includes('Transcript is disabled') || err.message.includes('No transcript')) {
            console.log('   - Reason: Video does not have captions/subtitles enabled');
        } else if (err.message.includes('Video unavailable') || err.message.includes('private')) {
            console.log('   - Reason: Video is private, unlisted, or unavailable');
        } else if (err.message.includes('Invalid video')) {
            console.log('   - Reason: Invalid YouTube URL format');
        }
        
        return false;
    }
}

async function runTests() {
    console.log('\n🧪 YouTube Transcript Extraction Test Suite');
    console.log('='.repeat(60));
    
    if (testUrls.length === 0) {
        console.log('\n⚠️  No test URLs provided!');
        console.log('Edit this file and add YouTube URLs to the testUrls array.');
        return;
    }
    
    let passed = 0;
    let failed = 0;
    
    for (const url of testUrls) {
        const result = await testYouTubeTranscript(url);
        if (result) {
            passed++;
        } else {
            failed++;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total: ${testUrls.length}`);
    console.log('='.repeat(60) + '\n');
}

// Run the tests
runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
