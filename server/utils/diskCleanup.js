/**
 * server/utils/diskCleanup.js
 *
 * Automated Disk Cleanup & File Retention Manager.
 * Scans uploads/ and intermediate cache directories, safely unlinking files older than the retention threshold.
 * Prevents server disk exhaustion over long-running production lifecycles.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RETENTION_MS = parseInt(process.env.TEMP_FILE_RETENTION_MS, 10) || (60 * 60 * 1000); // 1 hour default
const CLEANUP_INTERVAL_MS = parseInt(process.env.DISK_CLEANUP_INTERVAL_MS, 10) || (15 * 60 * 1000); // 15 min

const TARGET_DIRECTORIES = [
  path.resolve(__dirname, '../uploads'),
  path.resolve(__dirname, '../data/cache/temp'),
  path.resolve(__dirname, '../data/cache/vision'),
  path.resolve(__dirname, '../data/cache/ocr')
];

/**
 * Scan and clean files in a directory older than maxAgeMs.
 * @param {string} dirPath
 * @param {number} maxAgeMs
 * @returns {number} count of deleted files
 */
function cleanDirectory(dirPath, maxAgeMs = RETENTION_MS) {
  if (!fs.existsSync(dirPath)) return 0;

  let deletedCount = 0;
  const now = Date.now();

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        deletedCount += cleanDirectory(fullPath, maxAgeMs);
      } else if (entry.isFile()) {
        // Exclude system files or .gitkeep
        if (entry.name.startsWith('.') || entry.name.endsWith('.traineddata')) continue;

        try {
          const stats = fs.statSync(fullPath);
          const ageMs = now - stats.mtimeMs;

          if (ageMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch (_) {
          // File may have been removed concurrently
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [DiskCleanup] Error scanning ${dirPath}: ${err.message}`);
  }

  return deletedCount;
}

/**
 * Run disk cleanup across all target temporary directories.
 */
function runDiskCleanup(maxAgeMs = RETENTION_MS) {
  let totalDeleted = 0;
  for (const dir of TARGET_DIRECTORIES) {
    totalDeleted += cleanDirectory(dir, maxAgeMs);
  }
  if (totalDeleted > 0) {
    console.log(`🧹 [DiskCleanup] Removed ${totalDeleted} expired temporary files.`);
  }
  return totalDeleted;
}

// Scheduled Background Worker
const _cleanupTimer = setInterval(() => {
  runDiskCleanup();
}, CLEANUP_INTERVAL_MS);

if (_cleanupTimer.unref) _cleanupTimer.unref();

module.exports = {
  runDiskCleanup,
  cleanDirectory
};
