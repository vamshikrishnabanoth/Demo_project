const path = require('path');
const fs = require('fs');
const serverDir = path.resolve(__dirname, '../../server');
require(path.join(serverDir, 'node_modules/dotenv')).config({ path: path.join(serverDir, '.env') });
const { Groq, toFile } = require(path.join(serverDir, 'node_modules/groq-sdk'));
const { segmentAudioUniversal, getAudioDuration } = require(path.join(serverDir, 'utils/audioChunker'));

async function testSliceAndTranscribe() {
  const audioPath = 'C:/Users/samanvi/Downloads/audi.mp3';
  console.log('Testing audio file access:', audioPath);
  console.log('File exists:', fs.existsSync(audioPath));
  const duration = getAudioDuration(audioPath);
  console.log('Duration:', duration, 'seconds (', (duration/60).toFixed(1), 'minutes)');

  const chunksDir = path.join(__dirname, 'mentor_lecture_validation', 'test_chunks');
  if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

  console.log('Testing slicing first 2 chunks (60s each for fast test)...');
  const chunks = await segmentAudioUniversal(audioPath, {
    segmentTimeSeconds: 60,
    outputDir: chunksDir
  });
  console.log('Total chunks created:', chunks.length);
  if (chunks.length > 0) {
    console.log('Chunk 0:', chunks[0]);
    console.log('Testing Groq transcription on chunk 0...');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const file = await toFile(fs.createReadStream(chunks[0].filePath), 'chunk_0.m4a');
    const res = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json'
    });
    console.log('Chunk 0 Transcribed successfully! Length:', res.text.length);
    console.log('Text preview:', res.text.slice(0, 150));
  }

  // Cleanup test chunks
  chunks.forEach(c => {
    try { if (fs.existsSync(c.filePath)) fs.unlinkSync(c.filePath); } catch (_) {}
  });
  try { fs.rmdirSync(chunksDir); } catch (_) {}
  console.log('Cleanup finished.');
}

testSliceAndTranscribe().catch(e => console.error('Error:', e));
