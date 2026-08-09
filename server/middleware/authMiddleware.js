const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Short-term in-memory cache for user session metadata to prevent DB pool exhaustion under heavy traffic
const userCache = new Map();
const CACHE_TTL_MS = 5000; // 5 seconds cache (faster suspension propagation)

function getCachedUser(userId) {
    const cached = userCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }
    return null;
}

function setCachedUser(userId, data) {
    userCache.set(userId, { data, timestamp: Date.now() });
    if (userCache.size > 2000) {
        // Simple sweep
        const now = Date.now();
        for (const [k, v] of userCache.entries()) {
            if (now - v.timestamp > CACHE_TTL_MS) userCache.delete(k);
        }
    }
}

// Export cache invalidation for immediate suspension propagation
function clearUserCache(userId) {
    userCache.delete(userId);
}

const authMiddleware = async function (req, res, next) {
    const token = req.cookies?.token || req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    let decoded;
    try {
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            // Grace period for active token expiration during live operations
            if (jwtErr.name === 'TokenExpiredError') {
                try {
                    decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
                    const expiredAt = jwtErr.expiredAt ? new Date(jwtErr.expiredAt).getTime() : 0;
                    const graceWindow = 2 * 60 * 1000; // 2 minute grace period (covers slow page loads only)
                    
                    if (decoded && decoded.user && (Date.now() - expiredAt < graceWindow)) {
                        // Issue sliding refresh token header for client synchronization
                        const newToken = jwt.sign({ user: decoded.user }, process.env.JWT_SECRET, { expiresIn: '12h' });
                        res.setHeader('X-Refreshed-Token', newToken);
                    } else {
                        return res.status(401).json({ msg: 'Token expired. Please login again.', code: 'TOKEN_EXPIRED' });
                    }
                } catch (verifyErr) {
                    return res.status(401).json({ msg: 'Token is not valid', code: 'INVALID_TOKEN' });
                }
            } else {
                return res.status(401).json({ msg: 'Token is not valid', code: 'INVALID_TOKEN' });
            }
        }

        if (!decoded || !decoded.user) {
            return res.status(401).json({ msg: 'Invalid token payload', code: 'INVALID_PAYLOAD' });
        }

        // Check in-memory cache first to spare database connection pool
        let user = getCachedUser(decoded.user.id);
        if (!user) {
            user = await prisma.user.findUnique({ 
                where: { id: decoded.user.id },
                select: { id: true, tokenVersion: true, isSuspended: true, suspensionReason: true, suspendedUntil: true }
            });
            if (user) setCachedUser(decoded.user.id, user);
        }

        // SECURITY: Strict tokenVersion check — if token lacks a version, treat as -1 (always fails)
        if (!user || (user.tokenVersion != null && user.tokenVersion !== (decoded.user.tokenVersion ?? -1))) {
            return res.status(401).json({ msg: 'Session expired or revoked. Please login again.', code: 'SESSION_REVOKED' });
        }

        if (user.isSuspended) {
            if (user.suspendedUntil && new Date() > user.suspendedUntil) {
                await prisma.user.update({
                    where: { id: decoded.user.id },
                    data: { isSuspended: false, suspendedUntil: null, suspensionReason: null }
                });
                userCache.delete(decoded.user.id);
            } else {
                return res.status(403).json({ 
                    msg: 'Your account has been suspended.', 
                    reason: user.suspensionReason || 'Violation of community guidelines.',
                    code: 'ACCOUNT_SUSPENDED'
                });
            }
        }

        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('[AUTH_MIDDLEWARE_ERROR]', err);
        res.status(401).json({ msg: 'Authentication check failed', code: 'AUTH_FAILED' });
    }
};

module.exports = authMiddleware;
module.exports.clearUserCache = clearUserCache;
