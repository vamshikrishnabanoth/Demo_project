require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Use Prisma's built-in query engine (industry standard)
// Connection is managed internally via DATABASE_URL in schema.prisma
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
