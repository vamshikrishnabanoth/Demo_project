-- Quiz Integrity Migration
-- Add isLocked, quizHash, publishedAt, publishedBy, version fields to Quiz table.
-- Run this manually if `prisma migrate dev` is unavailable.
--
-- For Neon/Supabase/Railway: paste in the SQL console.
-- For local PostgreSQL: run with psql or pgAdmin.

ALTER TABLE "Quiz"
  ADD COLUMN IF NOT EXISTS "isLocked"    BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quizHash"    TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "publishedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "version"     INTEGER   NOT NULL DEFAULT 1;

-- Verify columns were added:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Quiz'
  AND column_name IN ('isLocked', 'quizHash', 'publishedAt', 'publishedBy', 'version')
ORDER BY column_name;
