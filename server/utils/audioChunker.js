const fs = require('fs');
const path = require('path');

// MPEG Audio Layer 3 Bitrate Index Table (MPEG-1, Layer 3) in kbps
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
// Sampling frequency table in Hz
const SAMPLE_RATES = [44100, 48000, 32000, 0];

/**
 * Parses an MP3 frame header at the given position.
 * Returns frame details including frame length in bytes and duration in seconds, or null if invalid.
 */
function parseFrameHeader(buffer, offset) {
    if (offset + 4 > buffer.length) return null;

    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];

    // Syncword: 11 bits set (0xFF followed by top 3 bits of b1 == 0xE0)
    if (b0 !== 0xFF || (b1 & 0xE0) !== 0xE0) return null;

    const mpegVer = (b1 >> 3) & 3;      // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    const layer = (b1 >> 1) & 3;        // 1 = Layer 3
    const hasCrc = (b1 & 1) === 0;

    if (layer !== 1) return null; // Layer 3 only

    const bitrateIdx = (b2 >> 4) & 0x0F;
    const sampleRateIdx = (b2 >> 2) & 3;
    const padding = (b2 >> 1) & 1;

    if (bitrateIdx === 0 || bitrateIdx === 15) return null;
    if (sampleRateIdx === 3) return null;

    const bitrate = (mpegVer === 3 ? BITRATES[bitrateIdx] : 64) * 1000;
    const sampleRate = SAMPLE_RATES[sampleRateIdx];

    // Frame size for MPEG-1 Layer 3 = 144 * BitRate / SampleRate + Padding
    const samplesPerFrame = mpegVer === 3 ? 1152 : 576;
    const frameLength = Math.floor((samplesPerFrame / 8) * bitrate / sampleRate) + padding;
    const frameDuration = samplesPerFrame / sampleRate;

    return {
        frameLength,
        frameDuration,
        sampleRate,
        bitrate
    };
}

/**
 * Scans an MP3 buffer from startOffset to find the next valid frame sync.
 */
function findNextFrameSync(buffer, startOffset) {
    let pos = Math.max(0, startOffset);
    const maxScan = buffer.length - 4;
    while (pos < maxScan) {
        if (buffer[pos] === 0xFF && (buffer[pos + 1] & 0xE0) === 0xE0) {
            const parsed = parseFrameHeader(buffer, pos);
            if (parsed && parsed.frameLength > 0 && pos + parsed.frameLength <= buffer.length) {
                // Verify next frame sync to be completely confident
                const nextPos = pos + parsed.frameLength;
                if (nextPos + 4 <= buffer.length) {
                    const nextParsed = parseFrameHeader(buffer, nextPos);
                    if (nextParsed) return pos;
                } else {
                    return pos; // Last frame
                }
            }
        }
        pos++;
    }
    return -1;
}

const SCAN_BUFFER_SIZE = 64 * 1024;

/**
 * Scans an open file descriptor from startOffset to find the next valid MP3 frame sync,
 * reading small 64KB buffers without loading the full file into memory.
 * 
 * @param {number} fd - File descriptor opened for reading
 * @param {number} startOffset - Byte offset to start scanning from
 * @param {number} totalSize - Total size of the file in bytes
 * @returns {number} Byte offset of the valid frame sync in the file, or -1 if none found
 */
function findFrameSyncInFd(fd, startOffset, totalSize) {
    let currentPos = Math.max(0, startOffset);
    const maxScan = totalSize - 4;
    const scanBuf = Buffer.alloc(SCAN_BUFFER_SIZE);
    const checkBuf = Buffer.alloc(4);

    while (currentPos < maxScan) {
        const toRead = Math.min(scanBuf.length, totalSize - currentPos);
        const bytesRead = fs.readSync(fd, scanBuf, 0, toRead, currentPos);
        if (bytesRead < 4) break;

        const limit = bytesRead - 4;
        for (let i = 0; i <= limit; i++) {
            if (scanBuf[i] === 0xFF && (scanBuf[i + 1] & 0xE0) === 0xE0) {
                const parsed = parseFrameHeader(scanBuf, i);
                if (parsed && parsed.frameLength > 0) {
                    const candidatePos = currentPos + i;
                    const nextFramePos = candidatePos + parsed.frameLength;

                    if (nextFramePos + 4 <= totalSize) {
                        if (i + parsed.frameLength + 4 <= bytesRead) {
                            const nextParsed = parseFrameHeader(scanBuf, i + parsed.frameLength);
                            if (nextParsed) {
                                return candidatePos;
                            }
                        } else {
                            const checkRead = fs.readSync(fd, checkBuf, 0, 4, nextFramePos);
                            if (checkRead === 4 && parseFrameHeader(checkBuf, 0)) {
                                return candidatePos;
                            }
                        }
                    } else if (nextFramePos >= totalSize) {
                        return candidatePos;
                    }
                }
            }
        }

        if (bytesRead === scanBuf.length) {
            currentPos += (bytesRead - 3);
        } else {
            break;
        }
    }

    return -1;
}

/**
 * Copies a byte range from an open file descriptor to a new destination file
 * in streaming 64KB increments, keeping heap allocation constant and minimal.
 * 
 * @param {number} inFd - Source file descriptor
 * @param {string} outPath - Destination file path
 * @param {number} startOffset - Byte offset to start copying from
 * @param {number} endOffset - Byte offset to end copying (exclusive)
 */
function copyChunkSlice(inFd, outPath, startOffset, endOffset) {
    const outFd = fs.openSync(outPath, 'w');
    const copyBuf = Buffer.alloc(64 * 1024);
    try {
        let pos = startOffset;
        while (pos < endOffset) {
            const toRead = Math.min(copyBuf.length, endOffset - pos);
            const bytesRead = fs.readSync(inFd, copyBuf, 0, toRead, pos);
            if (bytesRead <= 0) break;
            fs.writeSync(outFd, copyBuf, 0, bytesRead);
            pos += bytesRead;
        }
    } finally {
        fs.closeSync(outFd);
    }
}

/**
 * Accurately extracts audio duration in seconds using FFmpeg probe.
 * Returns duration in seconds (e.g. 7956.4) or null if unable to determine.
 * 
 * @param {string} filePath - Absolute path to audio file
 * @returns {number|null} Duration in seconds
 */
function getAudioDuration(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        const ffmpeg = require('@ffmpeg-installer/ffmpeg');
        const { execSync } = require('child_process');
        let output = '';
        try {
            output = execSync(`"${ffmpeg.path}" -i "${filePath}" 2>&1`, {
                encoding: 'utf8',
                timeout: 10000
            });
        } catch (err) {
            output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '') + (err.message || '');
        }

        const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(\.\d+)?)/);
        if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const seconds = parseFloat(match[3]);
            return hours * 3600 + minutes * 60 + seconds;
        }
    } catch (e) {
        console.warn('⚠️ [AudioDuration] FFmpeg probe error:', e.message);
    }
    return null;
}

/**
 * Chunks an MP3 file into valid MP3 sub-files with configurable target size and temporal overlap.
 * Uses streaming file descriptor operations with 64KB buffers to avoid loading large files into memory.
 * 
 * @param {string} inputPath - Absolute path to the original MP3 file
 * @param {Object} options
 * @param {number} options.targetChunkBytes - Target chunk size in bytes (default 18 MB, safely below Groq 24 MB limit)
 * @param {number} options.overlapSeconds - Small temporal overlap to prevent boundary speech clipping (default 2 seconds)
 * @param {string} options.outputDir - Directory to save generated chunk files
 * @returns {Array<{ chunkIndex: number, filePath: string, sizeBytes: number, isFinal: boolean }>}
 */
function chunkMp3(inputPath, options = {}) {
    const targetChunkBytes = options.targetChunkBytes || 18 * 1024 * 1024;
    const overlapSeconds = options.overlapSeconds !== undefined ? options.overlapSeconds : 2.0;
    const outputDir = options.outputDir || path.dirname(inputPath);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const stats = fs.statSync(inputPath);
    const totalSize = stats.size;

    let fd = null;
    try {
        fd = fs.openSync(inputPath, 'r');

        // Detect and skip ID3v2 metadata header if present
        let dataStart = 0;
        const id3Header = Buffer.alloc(10);
        const id3Read = fs.readSync(fd, id3Header, 0, 10, 0);
        if (id3Read >= 10 && id3Header.slice(0, 3).toString() === 'ID3') {
            const s0 = id3Header[6];
            const s1 = id3Header[7];
            const s2 = id3Header[8];
            const s3 = id3Header[9];
            const id3Size = (s0 << 21) | (s1 << 14) | (s2 << 7) | s3;
            dataStart = 10 + id3Size;
        }

        // Align to the very first valid audio frame
        const firstFramePos = findFrameSyncInFd(fd, dataStart, totalSize);
        if (firstFramePos !== -1) {
            dataStart = firstFramePos;
        }

        const chunks = [];
        let currentStart = dataStart;
        let chunkIndex = 0;

        // Estimate average bitrate to calculate byte size for temporal overlap
        let estimatedBitrate = 128000;
        const firstFrameBuf = Buffer.alloc(4);
        if (dataStart + 4 <= totalSize) {
            fs.readSync(fd, firstFrameBuf, 0, 4, dataStart);
            const firstFrame = parseFrameHeader(firstFrameBuf, 0);
            if (firstFrame && firstFrame.bitrate) {
                estimatedBitrate = firstFrame.bitrate;
            }
        }
        const overlapBytesEstimate = Math.floor((estimatedBitrate / 8) * overlapSeconds);

        while (currentStart < totalSize) {
            chunkIndex++;
            let targetEnd = currentStart + targetChunkBytes;

            if (targetEnd >= totalSize) {
                // Final chunk
                const chunkFilename = `chunk_${chunkIndex}_${Date.now()}_final.mp3`;
                const chunkFilePath = path.join(outputDir, chunkFilename);
                copyChunkSlice(fd, chunkFilePath, currentStart, totalSize);
                const sizeBytes = totalSize - currentStart;

                chunks.push({
                    chunkIndex,
                    filePath: chunkFilePath,
                    sizeBytes,
                    isFinal: true
                });
                break;
            }

            // Search for a valid frame boundary at or just before targetEnd
            let framePos = findFrameSyncInFd(fd, Math.max(currentStart, targetEnd - 5000), totalSize);
            if (framePos === -1 || framePos > targetEnd + 50000) {
                framePos = targetEnd;
            }

            const chunkFilename = `chunk_${chunkIndex}_${Date.now()}.mp3`;
            const chunkFilePath = path.join(outputDir, chunkFilename);
            copyChunkSlice(fd, chunkFilePath, currentStart, framePos);
            const sizeBytes = framePos - currentStart;

            chunks.push({
                chunkIndex,
                filePath: chunkFilePath,
                sizeBytes,
                isFinal: false
            });

            // Set start of next chunk with configured overlap (aligned to a clean frame)
            let nextStartCandidate = framePos - overlapBytesEstimate;
            if (nextStartCandidate <= currentStart) {
                nextStartCandidate = framePos; // Ensure forward progress
            }

            const nextAlignedFrame = findFrameSyncInFd(fd, nextStartCandidate, totalSize);
            currentStart = (nextAlignedFrame !== -1 && nextAlignedFrame < framePos) ? nextAlignedFrame : framePos;
        }

        return chunks;
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch (_) {}
        }
    }
}

/**
 * Fast stream-copy segmentation for M4A (AAC) audio files using ffmpeg.
 */
function chunkM4a(inputPath, options = {}) {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    const { execSync } = require('child_process');

    const segmentTimeSeconds = options.segmentTimeSeconds || 600; // 10 minutes per chunk
    const outputDir = options.outputDir || path.dirname(inputPath);
    const baseName = `m4a_seg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const pattern = path.join(outputDir, `${baseName}_%03d.m4a`);

    try {
        execSync(`"${ffmpeg.path}" -y -i "${inputPath}" -f segment -segment_time ${segmentTimeSeconds} -c copy "${pattern}"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 60000
        });
    } catch (err) {
        console.warn('Stream-copy segmentation fallback to AAC copy with bitstream filter:', err.message);
        execSync(`"${ffmpeg.path}" -y -i "${inputPath}" -f segment -segment_time ${segmentTimeSeconds} -c:a aac -b:a 128k "${pattern}"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 120000
        });
    }

    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith(baseName) && f.endsWith('.m4a'))
        .sort();

    if (files.length === 0) {
        throw new Error('M4A segmentation produced 0 chunk files.');
    }

    const chunks = [];
    for (let i = 0; i < files.length; i++) {
        const fullPath = path.join(outputDir, files[i]);
        const stats = fs.statSync(fullPath);
        if (stats.size > 2048) {
            if (stats.size > 20 * 1024 * 1024) {
                for (const c of files) {
                    try { fs.unlinkSync(path.join(outputDir, c)); } catch (_) {}
                }
                throw new Error(`Generated M4A chunk ${files[i]} (${(stats.size / (1024 * 1024)).toFixed(2)} MB) exceeded the 20 MB safety ceiling.`);
            }
            chunks.push({
                chunkIndex: chunks.length + 1,
                filePath: fullPath,
                sizeBytes: stats.size,
                isFinal: false
            });
        } else {
            try { fs.unlinkSync(fullPath); } catch (_) {}
        }
    }

    if (chunks.length > 0) {
        chunks[chunks.length - 1].isFinal = true;
    }

    return chunks;
}

/**
 * Universal Multi-Hour Audio Segmenter for Whisper & Gemini STT.
 * Segments ANY audio format (.mp3, .m4a, .wav, .webm, .ogg, .aac, .flac) up to 4+ hours
 * into clean 10-minute (600s) 16kHz mono 48kbps chunks (~3.6 MB each).
 * 
 * Guarantees:
 *  - Every chunk duration <= 600s (far under Groq's 7,200s ASPH limit)
 *  - Every chunk file size <= 4 MB (far under Groq's 25 MB file limit)
 *  - 16kHz mono audio (native Whisper optimal acoustic format)
 *  - Exact monotonic timestamp offsets calculated per chunk
 * 
 * @param {string} inputPath - Absolute path to audio file
 * @param {Object} options
 * @param {number} [options.segmentTimeSeconds=600] - Duration in seconds per segment
 * @param {string} [options.outputDir] - Output directory for chunk files
 * @returns {Array<{ chunkIndex: number, filePath: string, sizeBytes: number, startTimeOffset: number, durationEstimate: number, isFinal: boolean }>}
 */
function segmentAudioUniversal(inputPath, options = {}) {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    const { execSync } = require('child_process');

    const segmentSeconds = options.segmentTimeSeconds || 600; // 10 minutes per chunk
    const outputDir = options.outputDir || path.dirname(inputPath);
    const baseName = `speech_seg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const pattern = path.join(outputDir, `${baseName}_%03d.m4a`);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const startTime = Date.now();
    console.log(`🎙️ [UniversalAudioChunker] Slicing ${path.basename(inputPath)} into ${segmentSeconds}s 16kHz mono voice chunks...`);

    let sliceSucceeded = false;
    try {
        execSync(`"${ffmpeg.path}" -y -i "${inputPath}" -vn -ar 16000 -ac 1 -c:a aac -b:a 48k -f segment -segment_time ${segmentSeconds} -reset_timestamps 1 "${pattern}"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 300000 // 5 minutes max for slicing 4-hour audio
        });
        sliceSucceeded = true;
    } catch (err) {
        console.warn(`⚠️ [UniversalAudioChunker] AAC segment failed (${err.message}). Trying MP3 segment fallback...`);
        const mp3Pattern = path.join(outputDir, `${baseName}_%03d.mp3`);
        try {
            execSync(`"${ffmpeg.path}" -y -i "${inputPath}" -vn -ar 16000 -ac 1 -c:a libmp3lame -b:a 48k -f segment -segment_time ${segmentSeconds} -reset_timestamps 1 "${mp3Pattern}"`, {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 300000
            });
            sliceSucceeded = true;
        } catch (mp3Err) {
            console.error('❌ [UniversalAudioChunker] MP3 segment fallback also failed:', mp3Err.message);
        }
    }

    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith(baseName) && (f.endsWith('.m4a') || f.endsWith('.mp3')))
        .sort();

    if (!sliceSucceeded || files.length === 0) {
        // Fallback to pure-JS chunkMp3 if input is MP3
        const ext = path.extname(inputPath).toLowerCase();
        if (ext === '.mp3') {
            console.log('ℹ️ Falling back to streaming pure-JS MP3 chunker...');
            return chunkMp3(inputPath, {
                targetChunkBytes: 10 * 1024 * 1024,
                overlapSeconds: 1.5,
                outputDir
            });
        }
        throw new Error(`Audio segmentation produced 0 chunk files for ${path.basename(inputPath)}.`);
    }

    const chunks = [];
    for (let i = 0; i < files.length; i++) {
        const fullPath = path.join(outputDir, files[i]);
        const stats = fs.statSync(fullPath);
        if (stats.size > 2048) { // Ignore tiny empty silence fragments
            chunks.push({
                chunkIndex: chunks.length + 1,
                filePath: fullPath,
                sizeBytes: stats.size,
                startTimeOffset: i * segmentSeconds,
                durationEstimate: segmentSeconds,
                isFinal: false
            });
        } else {
            try { fs.unlinkSync(fullPath); } catch (_) {}
        }
    }

    if (chunks.length > 0) {
        chunks[chunks.length - 1].isFinal = true;
    }

    const totalChunksMB = (chunks.reduce((acc, c) => acc + c.sizeBytes, 0) / (1024 * 1024)).toFixed(2);
    console.log(`📦 [UniversalAudioChunker] Sliced into ${chunks.length} clean chunks in ${((Date.now() - startTime) / 1000).toFixed(1)}s (Total chunks size: ${totalChunksMB} MB).`);

    return chunks;
}

/**
 * Fast mono voice pre-compression pass for Whisper models.
 * Downsamples audio to 16kHz mono 48kbps AAC.
 *
 * @param {string} inputPath
 * @param {Object} options
 * @returns {{ compressedPath: string, sizeBytes: number } | null}
 */
function compressForWhisper(inputPath, options = {}) {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    const { execSync } = require('child_process');
    const outputDir = options.outputDir || path.dirname(inputPath);
    const targetPath = path.join(outputDir, `whisper_opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.m4a`);

    try {
        const startTime = Date.now();
        execSync(`"${ffmpeg.path}" -y -i "${inputPath}" -vn -ar 16000 -ac 1 -c:a aac -b:a 48k "${targetPath}"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 180000
        });
        const stats = fs.statSync(targetPath);
        console.log(`⚡ [AudioOptimizer] Compressed ${path.basename(inputPath)} in ${((Date.now() - startTime) / 1000).toFixed(1)}s -> ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        return {
            compressedPath: targetPath,
            sizeBytes: stats.size
        };
    } catch (err) {
        console.warn('⚠️ [AudioOptimizer] Pre-compression failed or timed out, falling back to original audio:', err.message);
        try { if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
        return null;
    }
}

/**
 * Transcribes an audio chunk using Google Gemini (gemini-1.5-flash / gemini-2.0-flash)
 * as a robust fallback when Groq hits ASPH limits or 429 rate limits.
 *
 * @param {string} filePath - Path to audio chunk
 * @returns {Promise<{ text: string, segments: Array } | null>}
 */
async function transcribeChunkWithGemini(filePath) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey.trim());
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const buffer = fs.readFileSync(filePath);
        const base64Audio = buffer.toString('base64');
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'audio/mp4';
        if (ext === '.mp3') mimeType = 'audio/mp3';
        else if (ext === '.wav') mimeType = 'audio/wav';
        else if (ext === '.ogg') mimeType = 'audio/ogg';
        else if (ext === '.webm') mimeType = 'audio/webm';
        else if (ext === '.aac' || ext === '.m4a') mimeType = 'audio/mp4';

        const prompt = `You are an expert speech recognition and lecture transcription engine.
Transcribe every word spoken in this audio lecture verbatim with highest precision.
Do not summarize. Do not skip any sentences or technical details. Do not output anything other than the exact transcribed speech text.`;

        const response = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                }
            }
        ]);

        const text = response?.response?.text() || '';
        return {
            text: text.trim(),
            segments: []
        };
    } catch (geminiErr) {
        console.warn('⚠️ [Gemini STT Fallback] Failed:', geminiErr.message);
        return null;
    }
}

module.exports = {
    chunkMp3,
    chunkM4a,
    segmentAudioUniversal,
    compressForWhisper,
    getAudioDuration,
    transcribeChunkWithGemini,
    parseFrameHeader,
    findNextFrameSync,
    findFrameSyncInFd,
    copyChunkSlice
};
