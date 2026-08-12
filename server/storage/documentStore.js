/**
 * Server-Side Document Persistence Layer & Document ID Store (v3.2.0)
 * Stores extracted document text, page chunks, metadata, and NormalizedDocumentProfiles
 * by stable SHA-256 documentId. Prevents storing heavy raw text in client localStorage.
 */

const crypto = require('crypto');

// In-Memory Document Store with LRU eviction and TTL cleanup
class DocumentStore {
  constructor(maxSize = 100, ttlMs = 24 * 60 * 60 * 1000) { // 24 hours default TTL
    this.store = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  generateDocumentId(text, filename) {
    const raw = `${filename}_${text.slice(0, 500)}_${text.length}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
    return `doc_${hash}`;
  }

  saveDocument({ filename, ext, totalPages = 1, textContent = '', documentProfile = null }) {
    if (!textContent || typeof textContent !== 'string') {
      throw new Error('DocumentStore: Invalid textContent provided for document saving.');
    }

    const documentId = this.generateDocumentId(textContent, filename);
    const lines = textContent.split('\n');
    const totalLines = lines.length;
    const linesPerPage = Math.max(1, Math.ceil(totalLines / Math.max(1, totalPages)));

    const entry = {
      documentId,
      filename,
      ext: ext.replace('.', '').toLowerCase(),
      totalPages: Math.max(1, totalPages),
      textContent,
      lines,
      linesPerPage,
      documentProfile,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    };

    // Evict oldest entry if maxSize reached
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }

    this.store.set(documentId, entry);
    return entry;
  }

  getDocument(documentId) {
    if (!documentId || !this.store.has(documentId)) {
      return null;
    }
    const entry = this.store.get(documentId);
    if (Date.now() > entry.expiresAt) {
      this.store.delete(documentId);
      return null;
    }
    return entry;
  }

  getScopedText(documentId, startPage = 1, endPage = 999) {
    const doc = this.getDocument(documentId);
    if (!doc) return null;

    const start = Math.max(1, startPage);
    const end = Math.min(doc.totalPages, Math.max(start, endPage));

    const sLine = Math.max(0, (start - 1) * doc.linesPerPage);
    const eLine = Math.min(doc.lines.length, end * doc.linesPerPage);

    const scopedSnippet = doc.lines.slice(sLine, eLine).join('\n');
    return {
      documentId: doc.documentId,
      filename: doc.filename,
      startPage: start,
      endPage: end,
      totalPages: doc.totalPages,
      scopedText: scopedSnippet,
      documentProfile: doc.documentProfile
    };
  }

  clear() {
    this.store.clear();
  }
}

const globalDocumentStore = new DocumentStore();

module.exports = globalDocumentStore;
