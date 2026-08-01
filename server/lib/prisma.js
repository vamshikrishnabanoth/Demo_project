require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Use Prisma's built-in query engine (industry standard)
// Connection is managed internally via DATABASE_URL in schema.prisma, overridden here to guarantee pool limits
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
        db: {
            url: (() => {
                let url = process.env.DATABASE_URL;
                if (url && !url.includes('connection_limit=')) {
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}connection_limit=10&pool_timeout=10`;
                }
                return url;
            })()
        }
    }
});

module.exports = prisma;
