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

/**
 * Chunks an MP3 file into valid MP3 sub-files with configurable target size and temporal overlap.
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

    const fileBuffer = fs.readFileSync(inputPath);
    const totalSize = fileBuffer.length;

    // Detect and skip ID3v2 metadata header if present
    let dataStart = 0;
    if (fileBuffer.slice(0, 3).toString() === 'ID3') {
        const s0 = fileBuffer[6];
        const s1 = fileBuffer[7];
        const s2 = fileBuffer[8];
        const s3 = fileBuffer[9];
        const id3Size = (s0 << 21) | (s1 << 14) | (s2 << 7) | s3;
        dataStart = 10 + id3Size;
    }

    // Align to the very first valid audio frame
    const firstFramePos = findNextFrameSync(fileBuffer, dataStart);
    if (firstFramePos !== -1) {
        dataStart = firstFramePos;
    }

    const chunks = [];
    let currentStart = dataStart;
    let chunkIndex = 0;

    // Estimate average bitrate to calculate byte size for temporal overlap
    const firstFrame = parseFrameHeader(fileBuffer, dataStart);
    const estimatedBitrate = firstFrame ? firstFrame.bitrate : 128000;
    const overlapBytesEstimate = Math.floor((estimatedBitrate / 8) * overlapSeconds);

    while (currentStart < totalSize) {
        chunkIndex++;
        let targetEnd = currentStart + targetChunkBytes;

        if (targetEnd >= totalSize) {
            // Final chunk
            const chunkSlice = fileBuffer.slice(currentStart, totalSize);
            const chunkFilename = `chunk_${chunkIndex}_${Date.now()}_final.mp3`;
            const chunkFilePath = path.join(outputDir, chunkFilename);
            fs.writeFileSync(chunkFilePath, chunkSlice);

            chunks.push({
                chunkIndex,
                filePath: chunkFilePath,
                sizeBytes: chunkSlice.length,
                isFinal: true
            });
            break;
        }

        // Search for a valid frame boundary at or just before targetEnd
        let framePos = findNextFrameSync(fileBuffer, targetEnd - 5000);
        if (framePos === -1 || framePos > targetEnd + 50000) {
            framePos = targetEnd;
        }

        const chunkSlice = fileBuffer.slice(currentStart, framePos);
        const chunkFilename = `chunk_${chunkIndex}_${Date.now()}.mp3`;
        const chunkFilePath = path.join(outputDir, chunkFilename);
        fs.writeFileSync(chunkFilePath, chunkSlice);

        chunks.push({
            chunkIndex,
            filePath: chunkFilePath,
            sizeBytes: chunkSlice.length,
            isFinal: false
        });

        // Set start of next chunk with configured overlap (aligned to a clean frame)
        let nextStartCandidate = framePos - overlapBytesEstimate;
        if (nextStartCandidate <= currentStart) {
            nextStartCandidate = framePos; // Ensure forward progress
        }

        const nextAlignedFrame = findNextFrameSync(fileBuffer, nextStartCandidate);
        currentStart = (nextAlignedFrame !== -1 && nextAlignedFrame < framePos) ? nextAlignedFrame : framePos;
    }

    return chunks;
}

/**
 * Fast stream-copy segmentation for M4A (AAC) audio files using ffmpeg.
 * Slices directly on AAC frame boundaries without re-encoding, ensuring no re-encoding quality loss.
 * Enforces that every chunk is strictly verified to be < 20 MB before returning.
 * 
 * @param {string} inputPath - Absolute path to the original M4A file
 * @param {Object} options
 * @param {number} options.segmentTimeSeconds - Duration per segment (default 600s = 10 mins, typically ~9-12 MB for speech)
 * @param {string} options.outputDir - Directory to save generated chunk files
 * @returns {Array<{ chunkIndex: number, filePath: string, sizeBytes: number, isFinal: boolean }>}
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
        // Ignore tiny trailing silence fragments (< 2KB)
        if (stats.size > 2048) {
            // HARD SAFETY CEILING: verify every chunk is strictly < 20 MB before returning
            if (stats.size > 20 * 1024 * 1024) {
                // Clean up any generated chunks
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
 * Fast mono voice pre-compression pass for Whisper Large-v3.
 * Downsamples audio to 16kHz mono 48kbps AAC.
 * Whisper internally processes 16kHz mono log-Mel spectrograms, so this downsampling
 * preserves full acoustic speech fidelity while reducing file size by 60-70%,
 * allowing lectures up to ~55 minutes to be transcribed in a single API call (< 20MB).
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
            timeout: 120000
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

module.exports = {
    chunkMp3,
    chunkM4a,
    compressForWhisper,
    parseFrameHeader,
    findNextFrameSync
};

