-- ============================================================================
-- KMIT KAHOOT PRODUCTION MIGRATION: sourceTaskId @unique & Broadcast Lease
-- Baseline: 9b0b8872fdb8483377288e45574e2b836ed136d4
-- Specification: PLAN-PROD-2026-11-08-REL-12-DEFINITIVE
-- ============================================================================

-- STEP 1: Guard against lock queue pile-ups on live tables
SET lock_timeout = '2s';

-- STEP 2: Add sourceTaskId to Quiz (instant metadata change once lock acquired)
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "sourceTaskId" TEXT;

-- STEP 3: Add lease fields to Broadcast table
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "leaseOwner" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "leaseToken" TEXT;

-- Reset lock timeout for subsequent index operations
RESET lock_timeout;

-- NOTE: In PostgreSQL, CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction block.
-- The runner script (scripts/run_production_migration.js) queries pg_index catalog:
-- 1. If Quiz_sourceTaskId_key exists and is valid (indisvalid = true), it preserves it intact.
-- 2. If it exists but is invalid (indisvalid = false), it drops it and rebuilds.
-- 3. If missing, it builds it concurrently.
