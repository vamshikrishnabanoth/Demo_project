/**
 * server/utils/pptxSlides.js
 *
 * Reads a .pptx file slide by slide: slide text in reading order, speaker notes, and the number of
 * images, keeping real slide numbers so page/slide ranges select the right slides.
 */

'use strict';

const AdmZip = require('adm-zip');

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&');
}

/** Extract paragraph text from DrawingML XML (<a:p> paragraphs containing <a:t> runs). */
function paragraphsFromXml(xml) {
  const paragraphs = [];
  const paraRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let m;
  while ((m = paraRegex.exec(xml)) !== null) {
    const runs = [];
    const runRegex = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    let r;
    while ((r = runRegex.exec(m[1])) !== null) runs.push(decodeXmlEntities(r[1]));
    const line = runs.join('').trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs;
}

/**
 * @param {string} filePath
 * @returns {Array<{ number: number, text: string, notes: string, imageCount: number }>}
 */
function readPptxSlides(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const byName = new Map(entries.map(e => [e.entryName, e]));
  const slideNames = entries
    .map(e => e.entryName)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/(\d+)\.xml$/)[1], 10) - parseInt(b.match(/(\d+)\.xml$/)[1], 10));

  // Presentation order comes from presentation.xml's slide id list when available.
  let ordered = slideNames;
  try {
    const pres = byName.get('ppt/presentation.xml')?.getData().toString('utf8') || '';
    const presRels = byName.get('ppt/_rels/presentation.xml.rels')?.getData().toString('utf8') || '';
    const relTargets = {};
    for (const rel of presRels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relTargets[rel[1]] = rel[2];
    const orderIds = [...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map(x => x[1]);
    const fromOrder = orderIds.map(id => relTargets[id]).filter(Boolean).map(t => `ppt/${t.replace(/^\/?ppt\//, '').replace(/^\.\.\//, '')}`);
    if (fromOrder.length > 0 && fromOrder.every(n => byName.has(n))) ordered = fromOrder;
  } catch (_) { /* fall back to numeric order */ }

  return ordered.map((name, idx) => {
    const xml = byName.get(name).getData().toString('utf8');
    const relsName = name.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const rels = byName.get(relsName)?.getData().toString('utf8') || '';
    const imageCount = (rels.match(/relationships\/image"/g) || []).length;
    let notes = '';
    const notesTarget = rels.match(/Type="[^"]*notesSlide"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*notesSlide"/);
    const notesPath = notesTarget ? `ppt/${(notesTarget[1] || notesTarget[2]).replace(/^\.\.\//, '')}` : null;
    if (notesPath && byName.has(notesPath)) {
      notes = paragraphsFromXml(byName.get(notesPath).getData().toString('utf8'))
        .filter(p => !/^\d+$/.test(p)) // drop slide-number placeholder
        .join('\n');
    }
    return { number: idx + 1, text: paragraphsFromXml(xml).join('\n'), notes, imageCount };
  });
}

/** Render selected slides as text with explicit slide markers. */
function renderSlides(slides, startSlide = 1, endSlide = Infinity) {
  return slides
    .filter(s => s.number >= startSlide && s.number <= endSlide)
    .map(s => {
      const parts = [`--- Slide ${s.number} ---`];
      if (s.text) parts.push(s.text);
      if (s.notes) parts.push(`Speaker notes: ${s.notes}`);
      if (s.imageCount > 0) parts.push(`[${s.imageCount} image${s.imageCount === 1 ? '' : 's'} on this slide]`);
      return parts.join('\n');
    })
    .join('\n\n');
}

module.exports = { readPptxSlides, renderSlides };
