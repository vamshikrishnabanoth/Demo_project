/**
 * server/engine/documentRouter/geminiVisionReader.js
 *
 * Reads scanned PDFs, photos of the board and handwritten notes with Gemini's multimodal models
 * (printed text, handwriting, tables, code and equations; diagrams described in one line).
 * Much faster and more accurate on handwriting than page-by-page Tesseract.
 *
 * - Files up to ~18 MB are sent inline; larger files go through the Gemini File API.
 * - Results are cached by file content hash (memory + disk), so the upload preview and the later
 *   generation request read a scan only once.
 * - Returns '' on failure so callers can fall back to OCR.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '..', '..', 'storage', 'vision_text_cache');
const READER_VERSION = 'vision-v1';
const memory = new Map();
const INLINE_LIMIT = 18 * 1024 * 1024;

const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
};

const PROMPT = `Transcribe this teaching material completely and faithfully, page by page, in reading order.
- Start each page with a line "--- Page N ---".
- Copy printed and handwritten text exactly (fix nothing, add nothing). Mark a word you cannot read as [illegible].
- Keep code, commands, SQL and equations exactly, each on its own lines.
- Write tables as rows of cells separated by " | ".
- For a diagram, figure or graph write one line: [Diagram: what it shows, including labels and values].
- Skip page headers/footers that repeat on every page (college name, page numbers).
Output plain text only.`;

const NOTES_PROMPT = `Read this teaching material page by page and write structured study notes of everything it teaches, in reading order.
- Start each page with a line "--- Page N ---".
- Keep every definition, rule, step, example, value and technical term; write code, commands, SQL and equations exactly, each on its own lines.
- Write tables as rows of cells separated by " | ". For a diagram write one line: [Diagram: what it shows, with labels and values].
- Use your own sentences for ordinary prose. Mark unreadable parts as [illegible].
Output plain text only.`;

function cacheKey(buf) {
  return crypto.createHash('sha256').update(READER_VERSION).update(buf).digest('hex');
}

function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const f = path.join(CACHE_DIR, `${key}.txt`);
    if (fs.existsSync(f)) { const t = fs.readFileSync(f, 'utf8'); memory.set(key, t); return t; }
  } catch (_) {}
  return null;
}

function writeCache(key, text) {
  memory.set(key, text);
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.txt`), text, 'utf8');
  } catch (_) {}
}

function withTimeout(p, ms, msg) {
  let t;
  return Promise.race([p.finally(() => clearTimeout(t)), new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })]);
}

/**
 * @param {string} filePath
 * @param {string} [originalName]
 * @returns {Promise<string>} transcribed text ('' when unavailable)
 */
async function readWithGemini(filePath, originalName = '') {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || process.env.DISABLE_GEMINI === 'true' || process.env.DISABLE_VISION_READER === 'true') return '';
  const ext = path.extname(originalName || filePath).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) return '';
  let buf;
  try { buf = fs.readFileSync(filePath); } catch (_) { return ''; }
  const key = cacheKey(buf);
  const hit = readCache(key);
  if (hit) return hit;

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  let filePart;
  let uploaded = null;
  if (buf.length <= INLINE_LIMIT) {
    filePart = { inlineData: { mimeType, data: buf.toString('base64') } };
  } else {
    try {
      const { GoogleAIFileManager, FileState } = require('@google/generative-ai/server');
      const fm = new GoogleAIFileManager(apiKey);
      const up = await fm.uploadFile(filePath, { mimeType, displayName: path.basename(originalName || filePath) });
      uploaded = { fm, name: up.file.name };
      let file = up.file;
      const started = Date.now();
      while (file.state === FileState.PROCESSING && Date.now() - started < 120000) {
        await new Promise(r => setTimeout(r, 2000));
        file = await fm.getFile(up.file.name);
      }
      if (file.state !== FileState.ACTIVE) throw new Error(`file state ${file.state}`);
      filePart = { fileData: { mimeType, fileUri: file.uri } };
    } catch (e) {
      console.warn(`[VisionReader] Upload of ${originalName} failed: ${e.message}`);
      return '';
    }
  }

  const models = (process.env.VISION_READER_MODELS || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')
    .split(',').map(s => s.trim()).filter(Boolean);

  // Long scans (e.g. 60+ handwritten pages) are read as parallel page ranges of the same uploaded file instead of
  // one huge request: a single request took 10+ minutes and could time out on every model in turn.
  let pageCount = 0;
  if (mimeType === 'application/pdf') {
    try { pageCount = (await withTimeout(require('pdf-parse')(buf), 30000, 'pdf-parse timeout')).numpages || 0; } catch (_) { pageCount = 0; }
  }
  const RANGE = Math.max(4, parseInt(process.env.VISION_PAGES_PER_CALL, 10) || 10);
  if (pageCount > RANGE + 2) {
    const ranges = [];
    for (let a = 1; a <= pageCount; a += RANGE) ranges.push([a, Math.min(pageCount, a + RANGE - 1)]);
    const out = new Array(ranges.length).fill('');
    const t0 = Date.now();
    let next = 0;
    const readRange = async ([a, b]) => {
      let p = `${PROMPT}\n\nOnly transcribe pages ${a} to ${b} of this PDF (counting from the first page of the file). Begin each page with "[Page n]".`;
      for (const model of models) {
        try {
          const m = genAI.getGenerativeModel({ model, generationConfig: { temperature: 0, maxOutputTokens: 30000 } });
          const r = await withTimeout(m.generateContent([filePart, { text: p }]), 150000, 'vision range timeout');
          const t = String(r.response.text() || '').trim();
          if (t.length >= 20) return t;
        } catch (e) {
          const msg = String(e.message || '');
          if (/RECITATION/i.test(msg)) p = `${NOTES_PROMPT}\n\nOnly cover pages ${a} to ${b} of this PDF. Begin each page with "[Page n]".`;
          console.warn(`[VisionReader] ${model} failed on pages ${a}-${b} of ${originalName}: ${msg.slice(0, 120)}`);
        }
      }
      return '';
    };
    const workers = Array.from({ length: Math.min(4, ranges.length) }, async () => {
      while (next < ranges.length) { const i = next++; out[i] = await readRange(ranges[i]); }
    });
    await Promise.all(workers);
    if (uploaded) { try { await uploaded.fm.deleteFile(uploaded.name); } catch (_) {} }
    const missing = ranges.filter((_, i) => !out[i]).map(([a, b]) => `${a}-${b}`);
    const joined = out.filter(Boolean).join('\n\n').trim();
    console.log(`[VisionReader] ${originalName}: ${pageCount} pages in ${ranges.length} parallel ranges, ${joined.length} chars in ${((Date.now() - t0) / 1000).toFixed(1)}s${missing.length ? ` (pages not read: ${missing.join(', ')})` : ''}`);
    if (joined.length >= 20 && !missing.length) writeCache(key, joined);
    return joined.length >= 20 ? joined : '';
  }

  let text = '';
  let prompt = PROMPT;
  for (const model of models) {
    for (let attempt = 0; attempt < 2 && text.length < 20; attempt++) {
      try {
        const m = genAI.getGenerativeModel({ model, generationConfig: { temperature: 0, maxOutputTokens: 60000 } });
        const t0 = Date.now();
        const r = await withTimeout(m.generateContent([filePart, { text: prompt }]), 300000, 'vision read timeout');
        text = String(r.response.text() || '').trim();
        if (text.length >= 20) {
          console.log(`[VisionReader] ${originalName}: ${text.length} chars via ${model}${prompt === NOTES_PROMPT ? ' (notes mode)' : ''} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        }
      } catch (e) {
        const msg = String(e.message || '');
        console.warn(`[VisionReader] ${model} failed for ${originalName}: ${msg.slice(0, 160)}`);
        // Verbatim transcription of textbook-like pages can be blocked as "recitation": retry as structured notes.
        if (/RECITATION/i.test(msg) && prompt !== NOTES_PROMPT) { prompt = NOTES_PROMPT; continue; }
        break;
      }
    }
    if (text.length >= 20) break;
  }
  if (uploaded) { try { await uploaded.fm.deleteFile(uploaded.name); } catch (_) {} }
  if (text.length >= 20) writeCache(key, text);
  return text.length >= 20 ? text : '';
}

/** True when a PDF's text layer is too thin to be the real content (scan / photographed pages). */
async function pdfLooksScanned(buf) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await withTimeout(pdfParse(buf), 30000, 'pdf-parse timeout');
    const pages = Math.max(1, data.numpages || 1);
    const chars = String(data.text || '').replace(/\s+/g, '').length;
    return { scanned: chars / pages < 120, pages, text: data.text || '' };
  } catch (_) {
    return { scanned: true, pages: 1, text: '' };
  }
}

module.exports = { readWithGemini, pdfLooksScanned };
