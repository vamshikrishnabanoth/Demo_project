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

module.exports = {
    chunkMp3,
    parseFrameHeader,
    findNextFrameSync
};
