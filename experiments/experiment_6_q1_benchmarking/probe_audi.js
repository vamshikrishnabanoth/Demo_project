const path = require('path');
const serverDir = path.resolve(__dirname, '../../server');
require(path.join(serverDir, 'node_modules/dotenv')).config({ path: path.join(serverDir, '.env') });
const { Groq, toFile } = require(path.join(serverDir, 'node_modules/groq-sdk'));
const ffmpeg = require(path.join(serverDir, 'node_modules/@ffmpeg-installer/ffmpeg'));
const { execSync } = require('child_process');
const fs = require('fs');

async function probeAudio() {
  const inputAudio = 'C:/Users/samanvi/Downloads/audi.mp3';
  const slicePath = path.join(__dirname, 'temp_probe_60s.mp3');
  
  console.log('Extracting 60s sample from audi.mp3...');
  execSync(`"${ffmpeg.path}" -y -ss 30 -t 60 -i "${inputAudio}" -ac 1 -ar 16000 "${slicePath}"`);
  
  console.log('Transcribing 60s sample with Groq Whisper...');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const file = await toFile(fs.createReadStream(slicePath), 'temp_probe_60s.mp3');
  const res = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    response_format: 'verbose_json'
  });
  
  console.log('\n--- Sample Transcript Text ---');
  console.log(res.text);
  
  if (fs.existsSync(slicePath)) fs.unlinkSync(slicePath);
}

probeAudio().catch(e => console.error('Error:', e));
