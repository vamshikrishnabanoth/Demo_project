const crypto = require('crypto');

/**
 * Request ID Middleware
 * Attaches a unique correlation ID (req.requestId) to every incoming HTTP request.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = existingId || crypto.randomUUID().slice(0, 8);

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

module.exports = requestIdMiddleware;
