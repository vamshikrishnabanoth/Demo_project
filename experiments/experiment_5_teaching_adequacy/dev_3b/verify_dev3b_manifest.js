/**
 * experiments/experiment_5_teaching_adequacy/dev_3b/verify_dev3b_manifest.js
 *
 * Verifies cryptographic SHA-256 integrity of all sealed dev_3b challenge corpus files.
 * Fail-Closed: Halts execution if any hash diverges or any file is missing.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DemoProjectDir = path.resolve(__dirname, '../../../');
const dev3bDir = __dirname;
const manifestFile = path.join(dev3bDir, 'dev_3b_corpus_manifest.json');

function verifyManifest() {
  console.log('='.repeat(80));
  console.log('🔒 VERIFYING DEV_3B CHALLENGE CORPUS CRYPTOGRAPHIC MANIFEST');
  console.log('='.repeat(80));

  if (!fs.existsSync(manifestFile)) {
    throw new Error(`[FAIL-CLOSED] Corpus manifest not found: ${manifestFile}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const files = manifest.files;
  const fileKeys = Object.keys(files).sort();

  console.log(`Corpus:           ${manifest.corpus}`);
  console.log(`Total Files:      ${fileKeys.length}`);
  console.log(`Total Segments:   ${manifest.total_segments}`);
  console.log(`Total Packages:   ${manifest.packages}`);
  console.log('-'.repeat(80));

  let matched = 0;
  for (const relPath of fileKeys) {
    const absPath = path.join(dev3bDir, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`[FAIL-CLOSED] Missing sealed challenge file: ${relPath}`);
    }

    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
    const expectedHash = files[relPath];

    if (actualHash !== expectedHash) {
      throw new Error(`[FAIL-CLOSED] Cryptographic hash mismatch on ${relPath}: expected ${expectedHash}, got ${actualHash}`);
    }

    console.log(`  ✓ ${relPath.padEnd(55)}: ${actualHash.substring(0, 16)}... (VERIFIED)`);
    matched++;
  }

  console.log('='.repeat(80));
  console.log(`✅ MANIFEST INTEGRITY VERIFIED: ${matched} / ${fileKeys.length} files cryptographically verified.`);
  console.log('🔒 Zero alterations detected in sealed dev_3b challenge set.');
  console.log('='.repeat(80));

  return true;
}

if (require.main === module) {
  try {
    verifyManifest();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  verifyManifest
};
