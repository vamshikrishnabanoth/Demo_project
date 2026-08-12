/**
 * server/engine/conceptGraphBuilder/utils/documentCleaner.js
 * 
 * MODULE 1 — INPUT SANITIZATION PREPROCESSOR
 * Cleans raw document text before concept extraction.
 * 
 * Removes:
 * - OCR garbage, page numbers, slide headers, TOC artifacts
 * - Duplicate Markdown headers & decorative separators
 * 
 * Preserves:
 * - Code blocks, Big-O notation, math formulas, version numbers, technical protocols
 */

'use strict';

function cleanDocument(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      cleanedText: '',
      stats: { ocrArtifactsRemoved: 0, headersNormalized: 0, linesCleaned: 0 }
    };
  }

  let ocrArtifactsRemoved = 0;
  let headersNormalized = 0;
  let linesCleaned = 0;

  // Preserve code blocks during cleaning by extracting them into placeholders
  const codeBlocks = [];
  let text = rawText.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length - 1}__`;
  });

  // Normalize line breaks & carriage returns
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split lines for line-level sanitization
  const lines = text.split('\n');
  const cleanedLines = [];
  const seenHeaders = new Set();

  for (let line of lines) {
    let trimmed = line.trim();

    // 1. Skip Page Numbers & Slide Headers (e.g., "Page 1 of 12", "Slide 5", "--- Page 3 ---")
    if (/^(?:page\s+\d+(?:\s+of\s+\d+)?|slide\s+\d+|-+\s*page\s*\d+\s*-+)$/i.test(trimmed)) {
      ocrArtifactsRemoved++;
      continue;
    }

    // 2. Skip Table of Contents dot leaders (e.g., "Chapter 1 .......... 14")
    if (/\.{4,}\s*\d+$/.test(trimmed)) {
      ocrArtifactsRemoved++;
      continue;
    }

    // 3. Skip OCR decorative borders & line noise (e.g., "==================", "+---------+")
    if (/^[=\-*_+~#|]{4,}$/.test(trimmed)) {
      ocrArtifactsRemoved++;
      continue;
    }

    // 4. Handle Markdown Headers: deduplicate identical headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1];
      const headerTitle = headerMatch[2].trim().replace(/\s+/g, ' ');
      const normKey = `${level}:${headerTitle.toLowerCase()}`;
      if (seenHeaders.has(normKey)) {
        headersNormalized++;
        continue; // Skip duplicate header
      }
      seenHeaders.add(normKey);
      trimmed = `${level} ${headerTitle}`;
    }

    // 5. Normalize spacing (multiple spaces to single space) while preserving placeholders
    if (!trimmed.startsWith('__CODE_BLOCK_PLACEHOLDER_')) {
      trimmed = trimmed.replace(/[ \t]+/g, ' ');
    }

    cleanedLines.push(trimmed);
    linesCleaned++;
  }

  // Rejoin cleaned lines, stripping excessive blank lines (more than 2 consecutive newlines)
  let cleanedText = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n');

  // Restore preserved code blocks
  codeBlocks.forEach((codeBlock, idx) => {
    cleanedText = cleanedText.replace(`__CODE_BLOCK_PLACEHOLDER_${idx}__`, codeBlock);
  });

  return {
    cleanedText: cleanedText.trim(),
    stats: {
      ocrArtifactsRemoved,
      headersNormalized,
      linesCleaned
    }
  };
}

module.exports = {
  cleanDocument
};
