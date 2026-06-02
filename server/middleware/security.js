/**
 * server/middleware/security.js
 *
 * Production-grade security middleware for PostgreSQL/Prisma stack.
 * Provides input sanitization, SQL injection detection, audit logging,
 * and request ID generation.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Security Log Setup ────────────────────────────────────────────────────────
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const securityLogStream = fs.createWriteStream(
    path.join(logsDir, 'security.log'),
    { flags: 'a' }
);

/**
 * Write a structured security event to the security log.
 * Never logs PII (passwords, tokens) — only metadata.
 */
function logSecurityEvent(event) {
    const entry = {
        timestamp: new Date().toISOString(),
        ...event,
    };
    securityLogStream.write(JSON.stringify(entry) + '\n');
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[SECURITY] ${entry.type}: ${entry.message || ''}`);
    }
}

// ── Request ID Middleware ─────────────────────────────────────────────────────
/**
 * Generates a unique X-Request-ID for every incoming request.
 * Enables distributed tracing and correlating security events.
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}

// ── Input Sanitizer ───────────────────────────────────────────────────────────
/**
 * Recursively sanitize all string values in an object:
 * - Strips null bytes (\x00) which can bypass security filters
 * - Strips control characters (except newline, tab, carriage return)
 * - Truncates excessively long strings (>10KB) to prevent payload bombs
 * - Does NOT modify non-string values (numbers, booleans, etc.)
 */
function sanitizeValue(value, maxLength = 10000) {
    if (typeof value === 'string') {
        return value
            // Remove null bytes
            .replace(/\0/g, '')
            // Remove control characters except \n, \r, \t
            .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // Truncate excessively long strings
            .slice(0, maxLength);
    }
    if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item, maxLength));
    }
    if (value && typeof value === 'object') {
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
            // Also sanitize keys (prevent prototype pollution)
            const safeKey = key.replace(/[^\w.-]/g, '_').slice(0, 200);
            if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') {
                continue; // Block prototype pollution attempts
            }
            sanitized[safeKey] = sanitizeValue(val, maxLength);
        }
        return sanitized;
    }
    return value;
}

function sanitizeInput(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeValue(req.query, 2000);
    }
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeValue(req.params, 500);
    }
    next();
}

// ── SQL Injection Detector ────────────────────────────────────────────────────
/**
 * Detects common SQL injection patterns in request inputs.
 * Since Prisma uses parameterized queries, this is defense-in-depth.
 * Logs suspicious requests and blocks obvious attack payloads.
 */
const SQL_INJECTION_PATTERNS = [
    /(\b(UNION\s+(ALL\s+)?SELECT)\b)/i,
    /(\b(INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE)\b)/i,
    /(\b(EXEC(\s+|\()|EXECUTE\s+))/i,
    /(;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|EXEC)\b)/i,
    /(';\s*--)/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\/\*[\s\S]*?\*\/)/,  // SQL block comments
    /(\bWAITFOR\s+DELAY\b)/i,
    /(\bBENCHMARK\s*\()/i,
    /(\bSLEEP\s*\()/i,
];

function checkForSqlInjection(value) {
    if (typeof value === 'string') {
        return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
        return value.some(item => checkForSqlInjection(item));
    }
    if (value && typeof value === 'object') {
        return Object.values(value).some(val => checkForSqlInjection(val));
    }
    return false;
}

function sqlInjectionDetector(req, res, next) {
    const sources = [req.body, req.query, req.params];
    
    for (const source of sources) {
        if (source && checkForSqlInjection(source)) {
            const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
            logSecurityEvent({
                type: 'SQL_INJECTION_ATTEMPT',
                message: `SQL injection pattern detected from IP ${clientIp}`,
                ip: clientIp,
                method: req.method,
                path: req.originalUrl,
                userAgent: req.headers['user-agent']?.substring(0, 200),
                requestId: req.requestId,
                userId: req.user?.id || null,
            });

            return res.status(400).json({
                msg: 'Request blocked: potentially malicious input detected.',
            });
        }
    }
    next();
}

// ── Security Event Logger Middleware ──────────────────────────────────────────
/**
 * Logs key security-relevant events (auth failures, suspicious activity).
 * Attaches to response 'finish' event to capture status codes.
 */
function securityEventLogger(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

        // Log failed authentication attempts
        if (res.statusCode === 401 || res.statusCode === 403) {
            logSecurityEvent({
                type: res.statusCode === 401 ? 'AUTH_FAILURE' : 'ACCESS_DENIED',
                message: `${res.statusCode} on ${req.method} ${req.originalUrl}`,
                ip: clientIp,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                duration,
                userAgent: req.headers['user-agent']?.substring(0, 200),
                requestId: req.requestId,
                userId: req.user?.id || null,
            });
        }

        // Log rate-limited requests
        if (res.statusCode === 429) {
            logSecurityEvent({
                type: 'RATE_LIMIT_HIT',
                message: `Rate limit exceeded from IP ${clientIp}`,
                ip: clientIp,
                method: req.method,
                path: req.originalUrl,
                requestId: req.requestId,
            });
        }
    });

    next();
}

module.exports = {
    requestIdMiddleware,
    sanitizeInput,
    sqlInjectionDetector,
    securityEventLogger,
    logSecurityEvent,
};
