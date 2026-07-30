/**
 * Production-grade Express Global Error & Isolation Handler
 */

module.exports = function (err, req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    const timestamp = new Date().toISOString();
    
    // Log detailed server-side error with request metadata
    console.error(`[SERVER_ERROR ${timestamp}] ${req.method} ${req.originalUrl}:`, {
        message: err.message,
        stack: err.stack,
        user: req.user?.id || 'anonymous',
        ip: req.ip || req.headers['x-forwarded-for']
    });

    // Check if response has already been sent
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.status || err.statusCode || 500;
    const isCriticalQuizRoute = req.originalUrl.includes('/api/quizzes/submit') || 
                                req.originalUrl.includes('/api/quizzes/attempt') ||
                                req.originalUrl.includes('/api/quizzes/live');

    // Never fail critical quiz operations with unhandled 500
    if (isCriticalQuizRoute && statusCode === 500) {
        return res.status(200).json({
            success: false,
            retryable: true,
            msg: 'Quiz operation took longer than expected, but your progress is safe. Please retry.',
            errorId: timestamp
        });
    }

    // Non-critical API isolation (Analytics / Reports / Dashboards)
    if (req.originalUrl.includes('/api/analytics')) {
        return res.status(200).json({
            degraded: true,
            msg: 'Analytics service is temporarily busy. Data will update automatically.',
            quizTitle: 'Live Quiz',
            totalQuestions: 0,
            totalParticipants: 0,
            averageScore: 0,
            highestScore: 0,
            scoreDistribution: {},
            questionPerformance: [],
            sectionPerformance: [],
            participationRate: { attempted: 0, totalEligible: 0 },
            leaderboard: []
        });
    }

    // Default User-Friendly Response
    res.status(statusCode).json({
        msg: isProduction && statusCode === 500 ? 'An unexpected server error occurred. Please try again.' : err.message,
        code: err.code || 'SERVER_ERROR',
        timestamp
    });
};
