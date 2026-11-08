/**
 * KMIT Kahoot — Automated Production Migration Runner
 * Baseline: 9b0b8872fdb8483377288e45574e2b836ed136d4
 * Specification: PLAN-PROD-2026-11-08-REL-12-DEFINITIVE
 * 
 * Safely adds sourceTaskId, leaseOwner, leaseExpiresAt, leaseToken.
 * Performs EXACT index-definition verification against pg_index, pg_class, pg_namespace, pg_attribute.
 * Confirms schema, table, unique status, validity, readiness, absence of predicates/expressions,
 * and exactly one key column: 'sourceTaskId'. Preserves ONLY a genuinely matching index.
 */

const path = require('path');
let pgModule, dotenvModule;
try {
  pgModule = require('pg');
} catch (_) {
  pgModule = require(path.resolve(__dirname, '../server/node_modules/pg'));
}
try {
  dotenvModule = require('dotenv');
} catch (_) {
  dotenvModule = require(path.resolve(__dirname, '../server/node_modules/dotenv'));
}
const { Client } = pgModule;
dotenvModule.config({ path: path.resolve(__dirname, '../server/.env') });

function isGenuinelyMatchingIndex(idx) {
  if (!idx) return false;
  return (
    idx.schema_name === 'public' &&
    idx.table_name === 'Quiz' &&
    idx.column_name === 'sourceTaskId' &&
    idx.indisunique === true &&
    idx.indisvalid === true &&
    idx.indisready === true &&
    idx.is_not_partial === true &&
    idx.is_not_expression === true &&
    Number(idx.indnkeyatts) === 1 &&
    Number(idx.indnatts) === 1
  );
}

async function runProductionMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // NOTE: Autocommit mode (no BEGIN/COMMIT wrapper) is required for CREATE/DROP INDEX CONCURRENTLY
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('🔗 [Migration] Connected to PostgreSQL.');

  try {
    console.log('🛡️ [Migration] Step 1: Setting lock_timeout = 2s...');
    await client.query("SET lock_timeout = '2s';");

    console.log('📦 [Migration] Step 2: Adding nullable columns to Quiz and Broadcast...');
    await client.query('ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "sourceTaskId" TEXT;');
    await client.query('ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "leaseOwner" TEXT;');
    await client.query('ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);');
    await client.query('ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "leaseToken" TEXT;');

    await client.query('RESET lock_timeout;');
    console.log('✅ [Migration] Columns verified.');

    console.log('🔍 [Migration] Step 3: Performing exact index-definition verification for Quiz_sourceTaskId_key...');
    const catalogRes = await client.query(`
      SELECT 
        c.relname AS index_name,
        n.nspname AS schema_name,
        t.relname AS table_name,
        a.attname AS column_name,
        i.indisvalid,
        i.indisready,
        i.indisunique,
        (i.indpred IS NULL) AS is_not_partial,
        (i.indexprs IS NULL) AS is_not_expression,
        i.indnkeyatts,
        i.indnatts
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
      WHERE c.relname = 'Quiz_sourceTaskId_key'
        AND t.relname = 'Quiz'
        AND n.nspname = 'public';
    `);

    if (catalogRes.rows.length > 0) {
      const idx = catalogRes.rows[0];
      if (isGenuinelyMatchingIndex(idx)) {
        console.log('✅ [Migration] Index Quiz_sourceTaskId_key genuinely matches schema, table, column (Quiz.sourceTaskId), unique, valid, ready, non-partial, non-expression. Preserving index intact.');
      } else {
        console.warn('⚠️ [Migration] Index Quiz_sourceTaskId_key exists but fails genuine match criteria:', idx);
        console.log('🔄 [Migration] Dropping non-matching/invalid index CONCURRENTLY...');
        await client.query('DROP INDEX CONCURRENTLY IF EXISTS "Quiz_sourceTaskId_key";');
        console.log('🚀 [Migration] Rebuilding genuine index CONCURRENTLY on Quiz(sourceTaskId)...');
        await client.query('CREATE UNIQUE INDEX CONCURRENTLY "Quiz_sourceTaskId_key" ON "Quiz"("sourceTaskId");');
      }
    } else {
      console.log('🚀 [Migration] Creating index Quiz_sourceTaskId_key CONCURRENTLY on Quiz(sourceTaskId)...');
      await client.query('CREATE UNIQUE INDEX CONCURRENTLY "Quiz_sourceTaskId_key" ON "Quiz"("sourceTaskId");');
    }

    // Step 4: Verification of exact index definition
    const verifyRes = await client.query(`
      SELECT 
        c.relname AS index_name,
        n.nspname AS schema_name,
        t.relname AS table_name,
        a.attname AS column_name,
        i.indisvalid,
        i.indisready,
        i.indisunique,
        (i.indpred IS NULL) AS is_not_partial,
        (i.indexprs IS NULL) AS is_not_expression,
        i.indnkeyatts,
        i.indnatts
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
      WHERE c.relname = 'Quiz_sourceTaskId_key'
        AND t.relname = 'Quiz'
        AND n.nspname = 'public';
    `);

    const verifiedIdx = verifyRes.rows[0];
    if (!isGenuinelyMatchingIndex(verifiedIdx)) {
      throw new Error(`Index definition verification failed: ${JSON.stringify(verifiedIdx)}`);
    }

    console.log(`🎯 [Migration] Exact index definition verified: table=${verifiedIdx.table_name}, col=${verifiedIdx.column_name}, valid=${verifiedIdx.indisvalid}, ready=${verifiedIdx.indisready}, unique=${verifiedIdx.indisunique}, non-partial=${verifiedIdx.is_not_partial}, non-expr=${verifiedIdx.is_not_expression}, keyCols=${verifiedIdx.indnkeyatts}`);
    console.log('✨ [Migration] Production migration completed successfully.');
  } finally {
    await client.end();
  }
}

module.exports = { runProductionMigration, isGenuinelyMatchingIndex };

if (require.main === module) {
  runProductionMigration().catch(err => {
    console.error('❌ [Migration] Failed:', err);
    process.exit(1);
  });
}
