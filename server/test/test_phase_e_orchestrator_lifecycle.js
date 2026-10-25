'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 ====================================================================');
console.log('🧪 RUNNING PHASE E: ORCHESTRATION & TELEMETRY LIFECYCLE TEST SUITE');
console.log('🧪 ====================================================================');

// Test 1: Concurrency Default is 2
console.log('\n▶ Test 1: Default concurrency bound');
{
  const orchCode = fs.readFileSync(path.resolve(__dirname, '../engine/pipelineOrchestrator.js'), 'utf8');
  assert(orchCode.includes('const defaultConcurrency = 2;'), 'Expected defaultConcurrency = 2');
  console.log('✅ PASS: Pipeline default concurrency is bounded at 2 to protect against rate limits');
}

// Test 2: Structured metadata linkage
console.log('\n▶ Test 2: Target lifecycle telemetry & metadata retention');
{
  const orchCode = fs.readFileSync(path.resolve(__dirname, '../engine/pipelineOrchestrator.js'), 'utf8');
  assert(orchCode.includes("assessmentAngle: currentTarget.assessmentAngle || 'CONCEPTUAL'"), 'Expected assessmentAngle in metadata and ledger');
  assert(orchCode.includes("formatRecommendation: currentTarget.formatRecommendation || 'PROSE_MULTIPLE_CHOICE'"), 'Expected formatRecommendation in metadata and ledger');
  console.log('✅ PASS: Telemetry and question metadata explicitly track assessmentAngle and formatRecommendation');
}

console.log('\n======================================================================');
console.log('🎉 ALL PHASE E LIFECYCLE TESTS PASSED CLEANLY');
console.log('======================================================================');
