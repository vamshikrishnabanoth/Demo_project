/**
 * scratch/test_trace_purge.js
 * 
 * Verifies rolling trace purge utility:
 * 1. Dry-run verification: reports candidates without altering files or manifest.
 * 2. Actual purge verification: unlinks expired files, preserves recent files, and synchronizes manifest.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { purgeExpiredTraces } = require('../server/utils/tracePurge');

function runPurgeVerification() {
  console.log('======================================================================');
  console.log('TRACE PURGE UTILITY VERIFICATION TEST');
  console.log('======================================================================\n');

  const sandboxDir = path.resolve(__dirname, 'sandbox_trace_purge');
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  const manifestPath = path.join(sandboxDir, 'manifest.json');
  const initialManifest = {
    traces: [
      { requestId: 'req_recent', traceFile: 'req_recent.jsonl' },
      { requestId: 'req_expired_1', traceFile: 'req_expired_1.jsonl' },
      { requestId: 'req_expired_2', traceFile: 'trace_req_expired_2.json' }
    ]
  };
  fs.writeFileSync(manifestPath, JSON.stringify(initialManifest, null, 2), 'utf-8');

  const fileRecent = path.join(sandboxDir, 'req_recent.jsonl');
  const fileExpired1 = path.join(sandboxDir, 'req_expired_1.jsonl');
  const fileExpired2 = path.join(sandboxDir, 'trace_req_expired_2.json');

  fs.writeFileSync(fileRecent, '{"type":"recent"}\n', 'utf-8');
  fs.writeFileSync(fileExpired1, '{"type":"expired_1"}\n', 'utf-8');
  fs.writeFileSync(fileExpired2, '{"type":"expired_2"}\n', 'utf-8');

  // Set timestamps: fileExpired1 & fileExpired2 to 14 days ago
  const fourteenDaysAgo = (Date.now() - (14 * 24 * 60 * 60 * 1000)) / 1000;
  fs.utimesSync(fileExpired1, fourteenDaysAgo, fourteenDaysAgo);
  fs.utimesSync(fileExpired2, fourteenDaysAgo, fourteenDaysAgo);

  console.log('[1] Testing DRY-RUN Mode (Retention = 7 days)...');
  const dryReport = purgeExpiredTraces({ targetDir: sandboxDir, retentionDays: 7, dryRun: true });
  console.log(`    - Scanned: ${dryReport.scannedCount}`);
  console.log(`    - Purged candidates: ${dryReport.purgedCount}`);
  console.log(`    - Retained: ${dryReport.retainedCount}`);

  // Assert no files were deleted in dry-run
  const dryFilesRemaining = fs.readdirSync(sandboxDir);
  const dryManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const dryRunVerified = (dryFilesRemaining.length === 4 && dryManifest.traces.length === 3);
  console.log(`    Dry-run file preservation: ${dryRunVerified ? 'PASS (Zero mutations made)' : 'FAIL'}`);

  console.log('\n[2] Testing ACTUAL PURGE Mode (Retention = 7 days)...');
  const actualReport = purgeExpiredTraces({ targetDir: sandboxDir, retentionDays: 7, dryRun: false });
  console.log(`    - Deleted files count: ${actualReport.purgedCount}`);
  console.log(`    - Manifest entries removed: ${actualReport.manifestEntriesRemoved}`);

  const postFilesRemaining = fs.readdirSync(sandboxDir);
  const postManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const expired1Exists = fs.existsSync(fileExpired1);
  const expired2Exists = fs.existsSync(fileExpired2);
  const recentExists = fs.existsSync(fileRecent);
  const manifestHasRecentOnly = (postManifest.traces.length === 1 && postManifest.traces[0].requestId === 'req_recent');

  const actualPurgeVerified = (!expired1Exists && !expired2Exists && recentExists && manifestHasRecentOnly);
  console.log(`    Actual purge deletion & manifest sync: ${actualPurgeVerified ? 'PASS (100% Verified)' : 'FAIL'}`);

  // Clean up sandbox
  fs.rmSync(sandboxDir, { recursive: true, force: true });

  console.log('\n======================================================================');
  console.log(`TRACE PURGE TEST RESULT: ${dryRunVerified && actualPurgeVerified ? 'ALL VERIFICATIONS PASSED' : 'FAILED'}`);
  console.log('======================================================================\n');
}

runPurgeVerification();
