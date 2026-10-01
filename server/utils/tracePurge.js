/**
 * server/utils/tracePurge.js
 * 
 * Rolling Automated Trace Retention & Purge Utility
 * 
 * Features:
 * - Scans server/logs/traces for .jsonl and .json files older than RETENTION_DAYS.
 * - Safely unlinks expired files and cleans corresponding entries from manifest.json.
 * - Supports dry-run simulation mode and programmatic invocation.
 * - Zero interference with active requests.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_RETENTION_DAYS = 7;
const TRACES_DIR = path.resolve(__dirname, '../logs/traces');
const MANIFEST_PATH = path.join(TRACES_DIR, 'manifest.json');

/**
 * Purges trace files older than retentionDays.
 */
function purgeExpiredTraces(options = {}) {
  const tracesDir = options.targetDir || TRACES_DIR;
  const manifestPath = path.join(tracesDir, 'manifest.json');
  const retentionDays = options.retentionDays || parseInt(process.env.TRACE_RETENTION_DAYS, 10) || DEFAULT_RETENTION_DAYS;
  const dryRun = options.dryRun || false;
  const cutoffTimeMs = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  const report = {
    timestamp: new Date().toISOString(),
    retentionDays,
    cutoffDate: new Date(cutoffTimeMs).toISOString(),
    dryRun,
    scannedCount: 0,
    purgedCount: 0,
    retainedCount: 0,
    freedBytes: 0,
    purgedFiles: [],
    errors: []
  };

  if (!fs.existsSync(tracesDir)) {
    return report;
  }

  try {
    const files = fs.readdirSync(tracesDir);
    const candidateFiles = files.filter(f => (f.endsWith('.jsonl') || (f.startsWith('trace_') && f.endsWith('.json'))) && f !== 'manifest.json');
    report.scannedCount = candidateFiles.length;

    const remainingFileNames = new Set(files);

    for (const filename of candidateFiles) {
      const filePath = path.join(tracesDir, filename);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < cutoffTimeMs) {
          report.purgedCount++;
          report.freedBytes += stats.size;
          report.purgedFiles.push(filename);

          if (!dryRun) {
            fs.unlinkSync(filePath);
            remainingFileNames.delete(filename);
          }
        } else {
          report.retainedCount++;
        }
      } catch (err) {
        report.errors.push({ file: filename, error: err.message });
      }
    }

    // Synchronize manifest.json
    if (!dryRun && report.purgedCount > 0 && fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (Array.isArray(manifest.traces)) {
          const originalLength = manifest.traces.length;
          manifest.traces = manifest.traces.filter(entry => {
            const tf = entry.traceFile;
            return tf && remainingFileNames.has(tf);
          });
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
          report.manifestEntriesRemoved = originalLength - manifest.traces.length;
        }
      } catch (manifestErr) {
        report.errors.push({ file: 'manifest.json', error: manifestErr.message });
      }
    }

  } catch (err) {
    report.errors.push({ globalError: err.message });
  }

  return report;
}

// CLI Execution if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const daysArgIdx = args.indexOf('--days');
  const days = daysArgIdx >= 0 ? parseInt(args[daysArgIdx + 1], 10) : DEFAULT_RETENTION_DAYS;

  console.log(`[TracePurge] Executing purge with retentionDays=${days} (dryRun=${dryRun})...`);
  const result = purgeExpiredTraces({ retentionDays: days, dryRun });
  console.log(`[TracePurge] Completed: Scanned ${result.scannedCount}, Purged ${result.purgedCount}, Retained ${result.retainedCount}, Freed ${(result.freedBytes / 1024).toFixed(1)} KB.`);
}

module.exports = { purgeExpiredTraces };
