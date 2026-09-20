/**
 * server/engine/documentRouter/tableExtractor.js
 *
 * Robust Table Detection & Markdown Table Serialization.
 * Converts unstructured tabular lines, grid alignments, and delimited rows into standard Markdown tables.
 */

'use strict';

class TableExtractor {
  /**
   * Determine if a set of consecutive lines represents a table.
   * @param {Array<string>} lines
   * @returns {boolean}
   */
  static isTabularBlock(lines) {
    if (!Array.isArray(lines) || lines.length < 2) return false;

    // Check for explicit table markers like pipes or ASCII table frames
    const hasPipes = lines.filter(l => (l.match(/\|/g) || []).length >= 2).length >= 2;
    if (hasPipes) return true;

    const hasAsciiGrid = lines.some(l => /^\+[-+]+\+$/.test(l.trim()));
    if (hasAsciiGrid) return true;

    // Check for multi-column tab/whitespace alignment (at least 2 consecutive lines with 3+ aligned columns)
    let columnMatches = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 10) {
        columnMatches++;
      }
    }
    return columnMatches >= 2 && columnMatches >= Math.floor(lines.length * 0.6);
  }

  /**
   * Convert raw lines into a clean Markdown table string.
   * @param {Array<string>} rawLines
   * @param {string} tableId
   * @returns {{ markdown: string, rowCount: number, colCount: number }}
   */
  static formatToMarkdownTable(rawLines, tableId = 'tbl_1') {
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return { markdown: '', rowCount: 0, colCount: 0 };
    }

    const rows = [];
    let maxCols = 0;

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed || /^\+[-+]+\+$/.test(trimmed) || /^[-=_\s]{3,}$/.test(trimmed)) {
        continue; // Skip decorative horizontal separator rules
      }

      let cells = [];
      if (trimmed.includes('|')) {
        cells = trimmed
          .split('|')
          .map(c => c.trim())
          .filter((c, idx, arr) => (idx > 0 && idx < arr.length - 1) || c.length > 0);
      } else if (trimmed.includes('\t')) {
        cells = trimmed.split('\t').map(c => c.trim());
      } else {
        cells = trimmed.split(/\s{2,}/).map(c => c.trim());
      }

      // Filter out empty lines or markdown separator rows like |---|---|
      if (cells.length > 0 && !cells.every(c => /^[-:]+$/.test(c))) {
        rows.push(cells);
        if (cells.length > maxCols) {
          maxCols = cells.length;
        }
      }
    }

    if (rows.length === 0 || maxCols < 2) {
      return { markdown: rawLines.join('\n'), rowCount: rows.length, colCount: maxCols };
    }

    // Normalize rows to have equal column count
    const normalized = rows.map(r => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push('-');
      return padded.map(c => (c === '' ? '-' : c.replace(/\|/g, '\\|')));
    });

    const header = normalized[0];
    const separator = Array(maxCols).fill('---');
    const dataRows = normalized.slice(1);

    const mdLines = [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`
    ];

    for (const row of dataRows) {
      mdLines.push(`| ${row.join(' | ')} |`);
    }

    return {
      markdown: mdLines.join('\n'),
      rowCount: normalized.length,
      colCount: maxCols
    };
  }

  /**
   * Scans a block of text and extracts detected tables with their surrounding text preserved.
   * @param {string} text
   * @returns {Array<{ type: 'text'|'table', content: string, metadata: Object }>}
   */
  static extractTablesAndText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n');
    const segments = [];
    let currentTextLines = [];
    let currentTableLines = [];
    let tableIndex = 1;

    const flushText = () => {
      if (currentTextLines.length > 0) {
        const content = currentTextLines.join('\n').trim();
        if (content) {
          segments.push({ type: 'paragraph', content, metadata: {} });
        }
        currentTextLines = [];
      }
    };

    const flushTable = () => {
      if (currentTableLines.length > 0) {
        const { markdown, rowCount, colCount } = TableExtractor.formatToMarkdownTable(
          currentTableLines,
          `table_${tableIndex}`
        );
        segments.push({
          type: 'table',
          content: markdown,
          metadata: {
            tableId: `tbl_${tableIndex++}`,
            rowCount,
            colCount
          }
        });
        currentTableLines = [];
      }
    };

    let i = 0;
    while (i < lines.length) {
      // Look ahead for 2-8 line tabular patterns
      const lookahead = lines.slice(i, i + 4);
      if (TableExtractor.isTabularBlock(lookahead)) {
        flushText();
        while (i < lines.length && lines[i].trim().length > 0) {
          currentTableLines.push(lines[i]);
          i++;
        }
        flushTable();
      } else {
        currentTextLines.push(lines[i]);
        i++;
      }
    }

    flushText();
    flushTable();

    return segments;
  }
}

module.exports = TableExtractor;
