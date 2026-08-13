const { GENERATOR_CONFIG } = require('../../config/generatorConfig');

/**
 * MODULE 4 — 3-STATE CIRCUIT BREAKER WITH COOLDOWN & AUTO-RECOVERY
 * States:
 *   CLOSED   (Normal operation)
 *   OPEN     (Failures exceeded threshold; requests blocked / routed to fallback)
 *   HALF_OPEN (Cooldown elapsed; probing provider with next request)
 */
class ProviderCircuitBreaker {
  constructor() {
    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.consecutiveFailures = 0;
    this.maxFailures = GENERATOR_CONFIG.CIRCUIT_BREAKER?.MAX_CONSECUTIVE_PROVIDER_FAILURES || 3;
    this.cooldownMs = GENERATOR_CONFIG.CIRCUIT_BREAKER?.COOLDOWN_MS || 3000; // 3 seconds fast recovery
    this.lastStateChange = Date.now();
    this.transientErrors = new Set(GENERATOR_CONFIG.TRANSIENT_PROVIDER_ERRORS || [429, 500, 502, 503, 504, 'ETIMEDOUT', 'ECONNREFUSED']);
  }

  getState() {
    // If OPEN and cooldown period has elapsed, transition to HALF_OPEN
    if (this.state === 'OPEN' && (Date.now() - this.lastStateChange) >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
      console.log('[CIRCUIT] Cooldown period elapsed. Entering HALF_OPEN state for probing.');
    }
    return this.state;
  }

  isBroken() {
    const currentState = this.getState();
    return currentState === 'OPEN';
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      console.log('[CIRCUIT] Provider probe succeeded! Recovered successfully. Returning to CLOSED state.');
    }
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.lastStateChange = Date.now();
  }

  recordFailure(error) {
    const errStr = String(error?.message || error?.code || error || '').toUpperCase();
    const isTransient = Array.from(this.transientErrors).some(t => errStr.includes(String(t).toUpperCase())) ||
                        errStr.includes('429') || errStr.includes('500') || errStr.includes('503') || errStr.includes('TIMEOUT');

    if (isTransient || this.state === 'HALF_OPEN') {
      this.consecutiveFailures += 1;

      if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.maxFailures) {
        this.state = 'OPEN';
        this.lastStateChange = Date.now();
        console.warn(`[CIRCUIT] Provider error threshold reached (${this.consecutiveFailures} failures). Entering OPEN state. Cooldown: ${this.cooldownMs / 1000}s.`);
      }
    }
  }

  reset() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.lastStateChange = Date.now();
  }
}

module.exports = new ProviderCircuitBreaker();
