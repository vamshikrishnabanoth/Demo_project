const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DIRECT_URL or DATABASE_URL environment variable is required.');
    process.exit(1);
}

async function main() {
    console.log('Attempting direct connection to Supabase DB (bypassing pooler)...');
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('✅ Connected successfully!');
        
        // Let's check active connections
        const res = await client.query(`
            SELECT count(*), state 
            FROM pg_stat_activity 
            GROUP BY state;
        `);
        console.log('Active connections breakdown:', res.rows);
        
        // Let's kill idle sessions to free up pooler connections!
        console.log('Terminating idle sessions to free up PgBouncer slots...');
        const terminateRes = await client.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE state = 'idle' AND pid <> pg_backend_pid();
        `);
        console.log(`✅ Terminated ${terminateRes.rowCount} idle sessions.`);
    } catch (err) {
        console.error('❌ Direct connection failed:', err.message);
    } finally {
        await client.end();
    }
}

main();
