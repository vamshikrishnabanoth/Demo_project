/**
 * Feature Flags Configuration for v3.5 Shadow Mode & Telemetry
 * 
 * Invariants:
 * - Strict boolean parsing prevents accidental enablement/disablement.
 * - Shadow mode and P5 intelligence are disabled by default for live student quiz generation.
 * - Phase 5 experimental outputs CANNOT block or abort live quiz generation.
 */

function parseBool(val, defaultVal = false) {
  if (val === undefined || val === null || val === '') return defaultVal;
  return String(val).trim().toLowerCase() === 'true';
}

const featureFlags = {
  // Phase 5 Intelligence Shadow Flags
  SHADOW_MODE_ENABLED: parseBool(process.env.ENABLE_SHADOW_MODE, false),
  ENABLE_P5_INTELLIGENCE: parseBool(process.env.ENABLE_P5_INTELLIGENCE, false),
  ENABLE_TEACHER_REVIEW_DASHBOARD: parseBool(process.env.ENABLE_TEACHER_REVIEW_DASHBOARD, true),
  
  // Hard Safety Invariants (Locked)
  ALLOW_P5_LIVE_BLOCKING: false,          // STRICTLY FALSE: Phase 5 cannot abort or delay live quizzes
  ALLOW_UNREVIEWED_GAP_GENERATION: false,  // STRICTLY FALSE: Gap targets cannot be pushed without teacher confirmation
  
  // Observability & Structured Tracing
  ENABLE_STRUCTURED_TRACING: parseBool(process.env.ENABLE_STRUCTURED_TRACING, true),
  TRACE_LOG_DIR: process.env.TRACE_LOG_DIR || 'server/logs/traces',
  
  // Resource Bounding for Shadow Tasks
  MAX_CONCURRENT_SHADOW_TASKS: 1,
  SHADOW_TASK_TIMEOUT_MS: 60000,
  SHADOW_QUEUE_MAX_SIZE: 10
};

// Startup log showing effective flag values
console.log('[FeatureFlags] Initialized with effective configuration:', {
  SHADOW_MODE_ENABLED: featureFlags.SHADOW_MODE_ENABLED,
  ENABLE_P5_INTELLIGENCE: featureFlags.ENABLE_P5_INTELLIGENCE,
  ENABLE_TEACHER_REVIEW_DASHBOARD: featureFlags.ENABLE_TEACHER_REVIEW_DASHBOARD,
  ENABLE_STRUCTURED_TRACING: featureFlags.ENABLE_STRUCTURED_TRACING,
  ALLOW_P5_LIVE_BLOCKING: featureFlags.ALLOW_P5_LIVE_BLOCKING,
  MAX_CONCURRENT_SHADOW_TASKS: featureFlags.MAX_CONCURRENT_SHADOW_TASKS
});

module.exports = featureFlags;
