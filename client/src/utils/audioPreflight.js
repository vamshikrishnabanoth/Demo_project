/**
 * Client-Side Audio Preflight & Downsampling Utility
 * 
 * For oversized uncompressed audio recordings (e.g. 50MB - 200MB WAV/AIFF from university lectures),
 * this preflight downsamples audio client-side using browser-native OfflineAudioContext to 16kHz mono WAV.
 * This cuts upload payload sizes by 4x-8x, drastically accelerating network upload speeds and reducing server load.
 */

function writeAsciiString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Encodes Float32Array mono audio samples into a standard 16-bit PCM WAV Blob.
 */
function encodeMonoWav(samples, sampleRate = 16000) {
    const dataByteLength = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    // RIFF identifier
    writeAsciiString(view, 0, 'RIFF');
    // file length minus RIFF identifier and length (36 + data length)
    view.setUint32(4, 36 + dataByteLength, true);
    // RIFF type
    writeAsciiString(view, 8, 'WAVE');

    // format chunk identifier
    writeAsciiString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 = raw linear PCM)
    view.setUint16(20, 1, true);
    // channel count (1 = mono)
    view.setUint16(22, 1, true);
    // sample rate (16000 Hz)
    view.setUint32(24, sampleRate, true);
    // byte rate (sampleRate * channels * bytesPerSample)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channels * bytesPerSample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);

    // data chunk identifier
    writeAsciiString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataByteLength, true);

    // Write 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

/**
 * Checks and conditionally downsamples an audio file before network upload.
 * If file is already <= 24 MB or is a compressed format, it returns unchanged.
 * If file is a large uncompressed audio file (> 24 MB), downsamples to 16kHz mono.
 * 
 * @param {File} file - Original user-selected file
 * @param {Function} [onStatusUpdate] - Optional status update callback
 * @returns {Promise<File>} - Optimized File or original File
 */
export async function preflightAudioFile(file, onStatusUpdate = null) {
    if (!file || typeof window === 'undefined') return file;

    // Files <= 24 MB don't need browser downsampling — upload directly
    const DIRECT_PASS_LIMIT = 24 * 1024 * 1024;
    if (file.size <= DIRECT_PASS_LIMIT) {
        return file;
    }

    // Safety ceiling: Files > 200 MB might exceed tab memory if decoded directly in JS
    if (file.size > 200 * 1024 * 1024) {
        return file;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isUncompressed = ['wav', 'wave', 'aiff', 'pcm'].includes(ext);

    // Only resample uncompressed formats where downsampling yields 4x-8x size reduction
    if (!isUncompressed) {
        return file;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;

    if (!AudioContextClass || !OfflineAudioContextClass) {
        return file;
    }

    try {
        if (onStatusUpdate) onStatusUpdate('Optimizing voice audio (16kHz mono)...');

        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new AudioContextClass();
        let decodedBuffer = null;
        try {
            decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } finally {
            try { await audioCtx.close(); } catch (_) {}
        }

        if (!decodedBuffer) return file;

        const targetSampleRate = 16000;
        const targetLength = Math.ceil(decodedBuffer.duration * targetSampleRate);

        const offlineCtx = new OfflineAudioContextClass(1, targetLength, targetSampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);

        const renderedBuffer = await offlineCtx.startRendering();
        const monoData = renderedBuffer.getChannelData(0);

        const wavBlob = encodeMonoWav(monoData, targetSampleRate);
        const originalBase = file.name.replace(/\.[^/.]+$/, '');
        const optimizedFile = new File([wavBlob], `${originalBase}_16k.wav`, { type: 'audio/wav' });

        console.log(`⚡ [AudioPreflight] Optimized ${(file.size / (1024 * 1024)).toFixed(1)} MB -> ${(optimizedFile.size / (1024 * 1024)).toFixed(1)} MB`);

        if (optimizedFile.size < file.size) {
            return optimizedFile;
        }
        return file;
    } catch (err) {
        console.warn('⚠️ [AudioPreflight] Client-side downsample skipped, falling back to direct upload:', err.message);
        return file;
    }
}
