/**
 * Verification Suite for Database Safety Guard
 */

const {
    enforceLocalDatabaseGuard,
    verifyLiveDatabaseConnection,
    LOCAL_TEST_DATABASE_URL
} = require('./test_db_guard');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`  FAIL: ${message}`);
        failed++;
        throw new Error(message);
    }
    console.log(`  PASS: ${message}`);
    passed++;
}

async function runTests() {
    console.log('=== TEST 1: Valid Local Database URL ===');
    process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
    const info = enforceLocalDatabaseGuard();
    assert(info.hostname === '127.0.0.1', 'Resolved host is 127.0.0.1');
    assert(info.port === '5432', 'Resolved port is 5432');
    assert(info.database === 'kahoot_local_test', 'Resolved db is kahoot_local_test');

    console.log('\n=== TEST 2: Dotenv Override Immunity ===');
    const dotenv = require('dotenv');
    // Attempt to override with cloud-like URL
    dotenv.config({ override: true });
    assert(
        process.env.DATABASE_URL === LOCAL_TEST_DATABASE_URL,
        'DATABASE_URL immune to dotenv.config override'
    );

    console.log('\n=== TEST 3: Rejection of Non-Local Host (e.g. Supabase) ===');
    process.env.DATABASE_URL = 'postgresql://postgres:secret@db.gwcfytsqfprrqqvxowaj.supabase.co:5432/kahoot_local_test';
    let rejectedHost = false;
    try {
        enforceLocalDatabaseGuard();
    } catch (err) {
        rejectedHost = err.message.includes('FORBIDDEN DATABASE HOST');
    }
    assert(rejectedHost, 'Forbidden non-local host is rejected immediately');

    console.log('\n=== TEST 4: Rejection of Non-Standard Port ===');
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:6543/kahoot_local_test';
    let rejectedPort = false;
    try {
        enforceLocalDatabaseGuard();
    } catch (err) {
        rejectedPort = err.message.includes('FORBIDDEN DATABASE PORT');
    }
    assert(rejectedPort, 'Forbidden port is rejected immediately');

    console.log('\n=== TEST 5: Rejection of Non-Test Database Name ===');
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/production_live';
    let rejectedDb = false;
    try {
        enforceLocalDatabaseGuard();
    } catch (err) {
        rejectedDb = err.message.includes('FORBIDDEN DATABASE NAME');
    }
    assert(rejectedDb, 'Forbidden database name is rejected immediately');

    console.log('\n=== TEST 6: Rejection of Cloud Keywords ===');
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/kahoot_local_test?param=supabase';
    let rejectedKeyword = false;
    try {
        enforceLocalDatabaseGuard();
    } catch (err) {
        rejectedKeyword = err.message.includes('Forbidden keyword');
    }
    assert(rejectedKeyword, 'Forbidden cloud keyword is rejected immediately');

    console.log('\n=== TEST 7: Live Database Verification Query ===');
    process.env.DATABASE_URL = LOCAL_TEST_DATABASE_URL;
    await verifyLiveDatabaseConnection();
    assert(true, 'Live database query successfully confirmed kahoot_local_test on 127.0.0.1:5432');

    console.log(`\n========================================`);
    console.log(`Guard Verification Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test run failed with error:', err);
    process.exit(1);
});
