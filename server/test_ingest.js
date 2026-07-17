const axios = require('axios');

async function testIngest() {
    console.log('Starting ingestion and RAG integration test...');
    
    const ingestPayload = {
        source: 'kmit_os_lecture_1',
        type: 'text',
        content: `
            Process Synchronization is a fundamental concept in modern Operating Systems. 
            It is a way to coordinate processes that use shared data. 
            It ensures that concurrent threads do not execute code segments that modify the same shared variables simultaneously.
            This prevents race conditions, where the final state depends on the order of execution.
            To achieve process synchronization, operating systems use semaphores, mutex locks, and monitors.
            A semaphore is an integer variable that is accessed through two standard atomic operations: wait() and signal().
            A binary semaphore can range only between 0 and 1, which behaves similarly to a mutex lock.
            A counting semaphore can range over an unrestricted domain, which is useful for resource allocation.
        `,
        metadata: {
            course: 'Operating Systems',
            branch: 'CSE',
            year: '3'
        }
    };

    try {
        // 1. Test Ingestion
        console.log('Sending ingest request to http://localhost:8000/admin/ingest ...');
        const ingestRes = await axios.post('http://localhost:8000/admin/ingest', ingestPayload);
        console.log('✅ Ingestion response:', ingestRes.data);

        // 2. Test RAG Retrieval via generate (topic mode)
        console.log('Testing topic-based generation RAG query for "semaphore wait signal"...');
        const generatePayload = {
            type: 'topic',
            content: 'Explain binary semaphores and wait signal operations in process synchronization',
            count: 2,
            difficulty: 'Medium'
        };

        const generateRes = await axios.post('http://localhost:8000/generate', generatePayload, { timeout: 120000 });
        console.log('✅ Generate response questions count:', generateRes.data.questions?.length);
        console.log('Draft Questions generated:');
        console.log(JSON.stringify(generateRes.data.questions, null, 2));

        console.log('=== Ingestion & RAG Verification PASSED ===');
        process.exit(0);
    } catch (err) {
        console.error('❌ Ingest test failed:');
        if (err.response) {
            console.error(`HTTP Error ${err.response.status}:`, err.response.data);
        } else {
            console.error(err.message);
        }
        process.exit(1);
    }
}

// Wait a bit to ensure the python server has loaded its sentence-transformer models
setTimeout(testIngest, 5000);
