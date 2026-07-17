const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('Testing pgvector support in database...');
    
    // Generate a mock 384-dimensional vector
    const mockVector = Array.from({ length: 384 }, () => Math.random() - 0.5);
    const vectorStr = `[${mockVector.join(',')}]`;

    try {
        // 1. Check if the pgvector extension is enabled
        const extCheck = await prisma.$queryRaw`
            SELECT extname FROM pg_extension WHERE extname = 'vector';
        `;
        if (extCheck.length === 0) {
            console.log('⚠️ pgvector extension is not enabled. Attempting to enable it...');
            await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
            console.log('✅ pgvector extension enabled successfully!');
        } else {
            console.log('✅ pgvector extension is active.');
        }

        // 2. Clear old test chunks
        await prisma.$executeRaw`DELETE FROM "DocumentChunk" WHERE source = 'pgvector_test_suite';`;

        // 3. Insert a test document chunk using raw parameterized SQL
        const chunkId = 'test-chunk-id-12345';
        const content = 'Data process synchronization in operating systems avoids data races and ensures concurrency safety.';
        const source = 'pgvector_test_suite';
        
        console.log('Inserting test chunk into "DocumentChunk"...');
        await prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, content, embedding, source, "createdAt")
            VALUES (${chunkId}, ${content}, ${vectorStr}::vector, ${source}, NOW());
        `;
        console.log('✅ Chunk inserted successfully!');

        // 4. Run similarity search raw query
        console.log('Running mock vector similarity search...');
        const searchVector = Array.from({ length: 384 }, () => Math.random() - 0.5);
        const searchVectorStr = `[${searchVector.join(',')}]`;
        
        const results = await prisma.$queryRaw`
            SELECT id, content, (embedding <=> ${searchVectorStr}::vector) as distance
            FROM "DocumentChunk"
            WHERE source = 'pgvector_test_suite'
            ORDER BY distance ASC
            LIMIT 1;
        `;
        
        console.log('✅ Similarity Search Results:', results);
        console.log('=== pgvector Verification PASSED ===');
    } catch (err) {
        console.error('❌ pgvector test failed:');
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
