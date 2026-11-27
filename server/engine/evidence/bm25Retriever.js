/**
 * server/engine/evidence/bm25Retriever.js
 *
 * Fast, pure Node.js Okapi BM25 sparse retriever.
 * Implements standard Okapi BM25 scoring with parameters k1 = 1.2, b = 0.75.
 */

'use strict';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

class BM25Retriever {
  /**
   * @param {Object} options - { k1: 1.2, b: 0.75 }
   */
  constructor(options = {}) {
    this.k1 = typeof options.k1 === 'number' ? options.k1 : 1.2;
    this.b = typeof options.b === 'number' ? options.b : 0.75;
    this.documents = [];
    this.docLengths = [];
    this.avgDocLength = 0;
    this.docTermFreqs = [];
    this.idf = new Map();
    this.N = 0;
  }

  /**
   * Tokenize and normalize input string.
   * @param {string} text
   * @returns {string[]}
   */
  static tokenize(text = '') {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w));
  }

  /**
   * Index an array of chunks/documents.
   * Each chunk should have at least { id/evidenceId, text }.
   * @param {Array<Object>} docs
   */
  index(docs = []) {
    this.documents = docs;
    this.N = docs.length;
    this.docLengths = new Array(this.N);
    this.docTermFreqs = new Array(this.N);
    this.idf.clear();

    if (this.N === 0) {
      this.avgDocLength = 0;
      return;
    }

    const df = new Map();
    let totalLength = 0;

    for (let i = 0; i < this.N; i++) {
      const doc = docs[i];
      const text = (doc.text || doc.fullText || doc.content || '');
      const tokens = BM25Retriever.tokenize(text);
      const len = tokens.length;

      this.docLengths[i] = len;
      totalLength += len;

      const tf = new Map();
      for (const t of tokens) {
        tf.set(t, (tf.get(t) || 0) + 1);
      }
      this.docTermFreqs[i] = tf;

      for (const term of tf.keys()) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    this.avgDocLength = totalLength / Math.max(1, this.N);

    // Compute Okapi BM25 IDF: ln((N - n + 0.5) / (n + 0.5) + 1)
    for (const [term, freq] of df.entries()) {
      const idfVal = Math.log(((this.N - freq + 0.5) / (freq + 0.5)) + 1.0);
      this.idf.set(term, Math.max(0.01, idfVal));
    }
  }

  /**
   * Score all indexed documents against a query string.
   * @param {string} query
   * @param {number} topK
   * @returns {Array<{ document: Object, score: number, rank: number }>}
   */
  search(query = '', topK = 10) {
    if (this.N === 0 || !query) return [];

    const queryTokens = BM25Retriever.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = new Array(this.N);

    for (let i = 0; i < this.N; i++) {
      const tfMap = this.docTermFreqs[i];
      const docLen = this.docLengths[i];
      let score = 0.0;

      for (const qTerm of queryTokens) {
        const idfVal = this.idf.get(qTerm);
        if (!idfVal) continue;

        const termFreq = tfMap.get(qTerm) || 0;
        if (termFreq === 0) continue;

        const numerator = termFreq * (this.k1 + 1);
        const denominator = termFreq + this.k1 * (1 - this.b + this.b * (docLen / Math.max(1, this.avgDocLength)));
        score += idfVal * (numerator / denominator);
      }

      scores[i] = {
        document: this.documents[i],
        score: Math.round(score * 10000) / 10000
      };
    }

    // Sort descending by BM25 score
    scores.sort((a, b) => b.score - a.score);

    return scores
      .slice(0, topK)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
  }
}

module.exports = BM25Retriever;
