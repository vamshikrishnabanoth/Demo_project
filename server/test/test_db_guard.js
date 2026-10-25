/**
 * Database Safety Guard for Local Test Execution
 * 
 * Enforces strict isolation:
 * - Requires hostname to be 127.0.0.1 or localhost
 * - Requires port to be 5432
 * - Requires database name to be kahoot_local_test
 * - Intercepts and monkey-patches dotenv.config to prevent .env files from overriding DATABASE_URL
 * - Verifies the live database connection via SELECT current_database()
 * - Aborts process immediately with exit code 1 if ANY safety requirement is violated
 */

const { URL } = require('url');

const EXPECTED_HOSTS = new Set(['127.0.0.1', 'localhost']);
const EXPECTED_PORT = '5432';
const EXPECTED_DB = 'kahoot_local_test';
const LOCAL_TEST_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:5432/kahoot_local_test?schema=public`;

function enforceLocalDatabaseGuard() {
    // 1. Set default test DATABASE_URL if not provided
    if (!process.env.DATABASE_URL) {
        process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
    }

    // 2. Protect against dotenv overrides
    try {
        const dotenv = require('dotenv');
        const originalConfig = dotenv.config;
        dotenv.config = function(options) {
            const result = originalConfig.apply(this, arguments);
            // Re-enforce local test database URL immediately after any .env load
            process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
            return result;
        };
    } catch (_) {
        // dotenv not loaded yet or unavailable
    }

    // 3. Parse and validate URL
    const rawUrl = process.env.DATABASE_URL;
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch (err) {
        const msg = `[CRITICAL SAFETY ABORT] Failed to parse DATABASE_URL: ${err.message}`;
        console.error(msg);
        throw new Error(msg);
    }

    // 4. Validate protocol
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
        const msg = `[CRITICAL SAFETY ABORT] Invalid protocol: ${parsed.protocol}. Expected postgresql:`;
        console.error(msg);
        throw new Error(msg);
    }

    // 5. Validate hostname
    if (!EXPECTED_HOSTS.has(parsed.hostname)) {
        const msg = `[CRITICAL SAFETY ABORT] FORBIDDEN DATABASE HOST: "${parsed.hostname}". ` +
                    `Tests are strictly forbidden from connecting to non-local databases! Aborting.`;
        console.error(msg);
        throw new Error(msg);
    }

    // 6. Validate port
    const port = parsed.port || '5432';
    if (port !== EXPECTED_PORT) {
        const msg = `[CRITICAL SAFETY ABORT] FORBIDDEN DATABASE PORT: "${port}". Expected ${EXPECTED_PORT}. Aborting.`;
        console.error(msg);
        throw new Error(msg);
    }

    // 7. Validate database name
    const dbName = parsed.pathname.replace(/^\//, '');
    if (dbName !== EXPECTED_DB) {
        const msg = `[CRITICAL SAFETY ABORT] FORBIDDEN DATABASE NAME: "${dbName}". Expected "${EXPECTED_DB}". Aborting.`;
        console.error(msg);
        throw new Error(msg);
    }

    // 8. Reject cloud keywords anywhere in connection string
    const forbiddenKeywords = ['supabase', 'pooler', 'aws', 'neon', 'render', 'azure', 'cloud'];
    for (const keyword of forbiddenKeywords) {
        if (rawUrl.toLowerCase().includes(keyword)) {
            const msg = `[CRITICAL SAFETY ABORT] Forbidden keyword "${keyword}" detected in DATABASE_URL. Aborting.`;
            console.error(msg);
            throw new Error(msg);
        }
    }

    console.log(`[SAFETY GUARD PASSED] Target database verified local: host=${parsed.hostname}, port=${port}, db=${dbName}`);
    return {
        hostname: parsed.hostname,
        port: port,
        database: dbName,
        url: LOCAL_TEST_DATABASE_URL
    };
}

async function verifyLiveDatabaseConnection() {
    const guardInfo = enforceLocalDatabaseGuard();
    const { Client } = require('pg');
    const client = new Client({
        connectionString: guardInfo.url,
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        const res = await client.query('SELECT current_database() AS db, current_user AS usr, inet_server_port() AS port;');
        const row = res.rows[0];
        if (row.db !== EXPECTED_DB) {
            throw new Error(`Connected database "${row.db}" does not match expected "${EXPECTED_DB}"!`);
        }
        console.log(`[LIVE DB CHECK PASSED] Connected to database="${row.db}", user="${row.usr}", port=${row.port}`);
    } finally {
        await client.end().catch(() => {});
    }
}

module.exports = {
    enforceLocalDatabaseGuard,
    verifyLiveDatabaseConnection,
    LOCAL_TEST_DATABASE_URL,
    EXPECTED_HOSTS,
    EXPECTED_PORT,
    EXPECTED_DB
};
