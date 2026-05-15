const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

module.exports = async function (req, res, next) {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if not token
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // SECURITY: Deep Session Validation & Suspension Check
        const user = await prisma.user.findUnique({ 
            where: { id: decoded.user.id },
            select: { tokenVersion: true, isSuspended: true, suspensionReason: true }
        });

        if (!user || user.tokenVersion !== decoded.user.tokenVersion) {
            return res.status(401).json({ msg: 'Session expired or revoked. Please login again.' });
        }

        if (user.isSuspended) {
            return res.status(403).json({ 
                msg: 'Your account has been suspended.', 
                reason: user.suspensionReason || 'Violation of community guidelines.' 
            });
        }

        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
