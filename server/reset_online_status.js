// Quick one-time fix: reset isOnline = false for ALL users
// This unblocks accounts stuck in "already logged in" lockout loop
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Resetting isOnline status for all users...');
    const result = await prisma.user.updateMany({
        data: { isOnline: false }
    });
    console.log(`✅ Reset ${result.count} user(s) to isOnline = false`);
}

main()
    .catch(e => { console.error('Error:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
