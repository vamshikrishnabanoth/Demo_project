// client/public/audioWorker.js

let audioChunks = [];

self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'START':
            audioChunks = [];
            break;
            
        case 'DATA_AVAILABLE':
            // Push incoming raw audio data array into background memory cache
            audioChunks.push(data);
            break;
            
        case 'STOP':
            // Assemble the final complete audio payload
            const blob = new Blob(audioChunks, { type: 'audio/webm; codecs=opus' });
            self.postMessage({ type: 'RECORDING_COMPLETE', blob: blob });
            audioChunks = [];
            break;
    }
};
