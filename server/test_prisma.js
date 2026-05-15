const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

async function test() {
    console.log('Testing Prisma connection...');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    
    try {
        await prisma.$connect();
        console.log('✅ Prisma connected successfully!');
        const userCount = await prisma.user.count();
        console.log(`✅ User count: ${userCount}`);
    } catch (err) {
        console.error('❌ Prisma connection failed:');
        console.error(err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

test();
