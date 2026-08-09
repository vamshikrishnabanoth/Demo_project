/**
 * IndexedDB Utility for Offline Resilient & Crash-Proof Voice Audio Recordings
 * Store Name: pending_audio_recordings
 */

const DB_NAME = 'pending_audio_recordings';
const DB_VERSION = 1;
const STORE_CHUNKS = 'audio_chunks';
const STORE_SESSIONS = 'sessions';

function openAudioDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id', autoIncrement: true });
        chunkStore.createIndex('sessionId', 'sessionId', { unique: false });
        chunkStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
        sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Initialize a new recording session record in IndexedDB
 */
export async function createSessionRecord(sessionId, metadata = {}) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    store.put({
      sessionId,
      createdAt: Date.now(),
      status: 'RECORDING',
      ...metadata
    });
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Failed to create IndexedDB session record:', err);
    return false;
  }
}

/**
 * Append a 10-second audio chunk immediately into IndexedDB
 */
export async function saveAudioChunk({ sessionId, chunkIndex, blobData, timestamp = Date.now() }) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    const store = tx.objectStore(STORE_CHUNKS);
    store.add({
      sessionId,
      chunkIndex,
      blobData,
      timestamp
    });
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Failed to save audio chunk to IndexedDB:', err);
    return false;
  }
}

/**
 * Retrieve all chunks for a given session sorted by chunkIndex
 */
export async function getSessionChunks(sessionId) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_CHUNKS, 'readonly');
    const store = tx.objectStore(STORE_CHUNKS);
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const chunks = request.result || [];
        chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(chunks);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to fetch session chunks from IndexedDB:', err);
    return [];
  }
}

/**
 * Combine all stored chunks for a session into a single Blob
 */
export async function reconstructSessionBlob(sessionId, mimeType = 'audio/webm') {
  const chunks = await getSessionChunks(sessionId);
  if (chunks.length === 0) return null;
  const blobParts = chunks.map(c => c.blobData);
  return new Blob(blobParts, { type: mimeType });
}

/**
 * Fetch all un-uploaded pending sessions for crash recovery
 */
export async function getPendingSessions() {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const sessions = request.result || [];
        resolve(sessions.filter(s => s.status !== 'COMPLETED'));
      };
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to fetch pending sessions from IndexedDB:', err);
    return [];
  }
}

/**
 * Mark a session as completed
 */
export async function markSessionCompleted(sessionId) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const getReq = store.get(sessionId);

    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, status: 'COMPLETED' });
      }
    };
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
    });
  } catch (err) {
    console.error('Failed to mark session as completed:', err);
    return false;
  }
}

/**
 * Clear/delete session and its chunks from IndexedDB
 */
export async function deleteSessionRecord(sessionId) {
  try {
    const db = await openAudioDB();
    
    // Clear chunks
    const txChunks = db.transaction(STORE_CHUNKS, 'readwrite');
    const chunkStore = txChunks.objectStore(STORE_CHUNKS);
    const index = chunkStore.index('sessionId');
    const getKeys = index.getAllKeys(sessionId);

    getKeys.onsuccess = () => {
      const keys = getKeys.result || [];
      keys.forEach(k => chunkStore.delete(k));
    };

    // Clear session
    const txSession = db.transaction(STORE_SESSIONS, 'readwrite');
    txSession.objectStore(STORE_SESSIONS).delete(sessionId);

    return true;
  } catch (err) {
    console.error('Failed to delete session record from IndexedDB:', err);
    return false;
  }
}
