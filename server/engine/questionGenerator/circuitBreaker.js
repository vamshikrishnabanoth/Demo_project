const { GENERATOR_CONFIG } = require('../../config/generatorConfig');

/**
 * 3. ISOLATED PROVIDER-ONLY CIRCUIT BREAKER
 * Increments consecutive failures ONLY on transient provider errors (429, 5xx, network timeouts).
 * Does NOT increment for content issues (INSUFFICIENT_EVIDENCE, SCHEMA_MISMATCH).
 */
class ProviderCircuitBreaker {
  constructor() {
    this.consecutiveFailures = 0;
    this.isCircuitBroken = false;
    this.maxFailures = GENERATOR_CONFIG.CIRCUIT_BREAKER.MAX_CONSECUTIVE_PROVIDER_FAILURES || 3;
    this.transientErrors = new Set(GENERATOR_CONFIG.TRANSIENT_PROVIDER_ERRORS);
  }

  isBroken() {
    return this.isCircuitBroken;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.isCircuitBroken = false;
  }

  recordFailure(error) {
    const errStr = String(error?.message || error?.code || error || '').toUpperCase();
    const isTransient = Array.from(this.transientErrors).some(t => errStr.includes(String(t).toUpperCase()));

    if (isTransient) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.maxFailures) {
        this.isCircuitBroken = true;
        console.warn(`[CIRCUIT BREAKER] Provider Circuit Broken! Reached ${this.consecutiveFailures} consecutive provider errors.`);
      }
    } else {
      // Content errors (INSUFFICIENT_EVIDENCE, SCHEMA_MISMATCH) do NOT trip provider circuit breaker
    }
  }

  reset() {
    this.consecutiveFailures = 0;
    this.isCircuitBroken = false;
  }
}

module.exports = new ProviderCircuitBreaker();
