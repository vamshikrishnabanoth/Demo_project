require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// ─── Connection Pool Configuration ─────────────────────────────────────────────
//
// DATABASE_POOL_SIZE controls the Prisma connection pool limit.
//
// Safe defaults by provider:
//   Neon free tier  : max 10 connections total  → use 8  (leave 2 for admin/migrations)
//   Neon Pro        : max 100+ connections       → use 15-20 is safe
//   Supabase free   : max 60 connections (pooler)→ use 10-15
//   Supabase Pro    : max 200+ connections       → use 20-30
//   Render PG       : 25 connections             → use 10-15
//   Self-hosted PG  : depends on max_connections → use (max_connections / 2 / num_instances)
//
// IMPORTANT: The primary scalability fix in this app is NOT increasing this number.
// Answer submissions no longer hit the DB synchronously. The pool is only used by:
//   - Background flush worker (bounded at FLUSH_CONCURRENCY=3 concurrent writes)
//   - Admin/auth/quiz management REST endpoints
//   - Quiz start/end operations
//   - DB keep-alive ping
//
// If you're unsure of your provider, keep the default of 10. Check your provider's
// dashboard for "max connections" and set DATABASE_POOL_SIZE to about 70% of that,
// divided by the number of server instances.

const rawPoolSize = parseInt(process.env.DATABASE_POOL_SIZE, 10);
const poolSize = (!isNaN(rawPoolSize) && rawPoolSize > 0) ? rawPoolSize : 10;
const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT, 10) || 15; // seconds

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
        db: {
            url: (() => {
                let url = process.env.DATABASE_URL;
                if (!url) return url;

                // Build query string params, preserving any already present
                const sep = url.includes('?') ? '&' : '?';
                const params = [];

                // Only inject if not already in the URL
                if (!url.includes('connection_limit=')) {
                    params.push(`connection_limit=${poolSize}`);
                }
                if (!url.includes('pool_timeout=')) {
                    params.push(`pool_timeout=${poolTimeout}`);
                }
                if (!url.includes('connect_timeout=')) {
                    params.push('connect_timeout=10');
                }

                return params.length > 0 ? `${url}${sep}${params.join('&')}` : url;
            })()
        }
    }
});

console.log(`[Prisma] Connection pool: limit=${poolSize}, pool_timeout=${poolTimeout}s`);

module.exports = prisma;
