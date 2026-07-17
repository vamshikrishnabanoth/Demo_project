const axios = require('axios');

async function test3Agent() {
    console.log('Starting 3-Agent Cognitive Core and dynamic flavors E2E test...');
    
    const ingestPayload = {
        source: 'kmit_os_ch3_processes',
        type: 'text',
        content: `
            Process Synchronization in operating systems.
            A race condition occurs when multiple processes access and manipulate the same data concurrently.
            To prevent race conditions, concurrent processes must be synchronized.
            Critical Section Problem: Each process has a segment of code, called a critical section, in which the process may be changing common variables, updating a table, writing a file, etc.
            When one process is executing in its critical section, no other process is allowed to execute in its critical section.
            Code segment for thread increment:
            let counter = 0;
            function increment() {
                let temp = counter;
                counter = temp + 1;
            }
            A race condition exists here because multiple threads executing increment() can read the same value of counter before updating it.
            Mutex locks and Semaphores are used to solve this problem.
            A mutex lock provides mutual exclusion. A thread acquires the lock before entering its critical section and releases it after leaving.
        `,
        metadata: {
            course: 'Operating Systems',
            chapter: '3'
        }
    };

    try {
        // 1. Ingest textbook
        console.log('Sending ingest request...');
        const ingestRes = await axios.post('http://localhost:8000/admin/ingest', ingestPayload);
        console.log('✅ Ingestion response:', ingestRes.data);

        // 2. Query 3-Agent Generation with multiple flavors
        console.log('Querying 3-Agent Generation Pipeline for dynamic quiz flavors...');
        const generatePayload = {
            type: 'topic',
            content: 'race condition and critical section in process synchronization',
            count: 3,
            difficulty: 'Medium',
            source_material_id: 'kmit_os_ch3',
            target_ratios: {
                theory: 0.33,
                code_debugging: 0.33,
                fill_blank: 0.34,
                scenario: 0.0
            }
        };

        // Increase timeout as local LLM running sequential Agent loops on CPU takes time
        const generateRes = await axios.post('http://localhost:8000/generate', generatePayload, { timeout: 180000 });
        console.log('✅ 3-Agent response status: 200 OK');
        
        const data = generateRes.data;
        console.log('\n--- VERIFYING STRUCTURAL OUTPUT BLUEPRINT ---');
        console.log('Metadata:', JSON.stringify(data.quiz_metadata, null, 2));
        console.log('Questions Count:', data.questions?.length);
        
        if (!data.quiz_metadata || !data.questions) {
            throw new Error('Missing top-level keys: quiz_metadata or questions.');
        }

        data.questions.forEach((q, idx) => {
            console.log(`\nQuestion #${idx + 1} (${q.type}):`);
            console.log(`- ID: ${q.id}`);
            console.log(`- Tag: ${q.concept_tag} (Weight: ${q.weight_score})`);
            console.log(`- Prompt: ${q.prompt_text}`);
            if (q.code_snippet) {
                console.log(`- Snippet:\n${q.code_snippet}`);
            }
            console.log(`- Options:`, q.options);
            console.log(`- Correct Answer: ${q.correct_answer}`);
            console.log(`- Explanation: ${q.explanation}`);

            // Validation checks
            if (!q.id || !q.type || !q.concept_tag || q.weight_score === undefined || !q.prompt_text || !q.options || !q.correct_answer || !q.explanation) {
                throw new Error(`Question #${idx + 1} is missing required fields according to the schema blueprint.`);
            }
            if (!q.options.includes(q.correct_answer)) {
                throw new Error(`Question #${idx + 1} correctAnswer is not present in options list.`);
            }
        });

        console.log('\n=== 3-Agent Cognitive Pipeline Verification PASSED ===');
        process.exit(0);
    } catch (err) {
        console.error('❌ E2E test failed:');
        if (err.response) {
            console.error(`HTTP Error ${err.response.status}:`, err.response.data);
        } else {
            console.error(err.message);
        }
        process.exit(1);
    }
}

// Wait 5 seconds to let the python service finish loading
setTimeout(test3Agent, 5000);
