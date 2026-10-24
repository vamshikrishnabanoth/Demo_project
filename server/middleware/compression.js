const compression = require('compression');

/**
 * Production-Grade HTTP Response Compression Middleware
 * Automatically compresses JSON and text responses over 1KB using gzip/deflate,
 * reducing payload transfer size by 70-85% and significantly reducing network latency.
 */
const gzipCompressionMiddleware = compression({
    level: 6, // Optimal balance between compression ratio and CPU usage
    threshold: 1024, // Only compress responses that are larger than 1KB
    filter: (req, res) => {
        // Do not compress if client explicitly opts out
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Fall back to standard filter (handles json, text, javascript, css, etc.)
        return compression.filter(req, res);
    }
});

module.exports = gzipCompressionMiddleware;
