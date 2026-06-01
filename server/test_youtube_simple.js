// Quick test to verify YouTube transcript extraction works
const { YoutubeTranscript } = require('youtube-transcript');

// Test with a known educational video that has captions
const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

console.log('Testing YouTube transcript extraction...');
console.log('URL:', testUrl);
console.log('');

YoutubeTranscript.fetchTranscript(testUrl)
    .then(transcript => {
        console.log('✅ SUCCESS!');
        console.log('Segments:', transcript.length);
        const fullText = transcript.map(item => item.text).join(' ');
        console.log('Total characters:', fullText.length);
        console.log('First 200 chars:', fullText.substring(0, 200));
    })
    .catch(err => {
        console.log('❌ FAILED');
        console.log('Error:', err.message);
        
        if (err.message.includes('Transcript is disabled') || err.message.includes('No transcript')) {
            console.log('\n💡 This video does not have captions. Try a different video.');
        } else if (err.message.includes('Video unavailable')) {
            console.log('\n💡 Video is unavailable or private.');
        }
    });
