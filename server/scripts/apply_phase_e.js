'use strict';

const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../engine/pipelineOrchestrator.js');
let raw = fs.readFileSync(targetFile, 'utf8');
const isCRLF = raw.includes('\r\n');
let code = raw.replace(/\r\n/g, '\n');

// 1. Set default concurrency to 2 to prevent Groq TPM rate limits
code = code.replace(
  'const defaultConcurrency = process.env.NODE_ENV === \'test\' ? 2 : 4;',
  'const defaultConcurrency = 2;'
);

// 2. Include assessmentAngle and formatRecommendation in decisionLedger
const oldLedgerBlock = `                concept: currentTarget.concept,
                subtopic: currentTarget.subtopic || 'Core Mechanism',
                cognitiveDimension: currentTarget.dimension,
                difficulty: currentTarget.targetDifficulty,
                intendedCognitiveOperation: currentTarget.intendedCognitiveOperation,`;

const newLedgerBlock = `                concept: currentTarget.concept,
                subtopic: currentTarget.subtopic || 'Core Mechanism',
                macroTopic: currentTarget.macroTopic || currentTarget.subtopic || 'Core Mechanism',
                cognitiveDimension: currentTarget.dimension,
                difficulty: currentTarget.targetDifficulty,
                intendedCognitiveOperation: currentTarget.intendedCognitiveOperation,
                assessmentAngle: currentTarget.assessmentAngle || 'CONCEPTUAL',
                formatRecommendation: currentTarget.formatRecommendation || 'PROSE_MULTIPLE_CHOICE',`;

if (!code.includes(oldLedgerBlock)) {
  throw new Error('Could not find oldLedgerBlock in pipelineOrchestrator.js');
}
code = code.replace(oldLedgerBlock, newLedgerBlock);

// 3. Ensure question metadata has assessmentAngle and formatRecommendation
const oldMetaBlock = `              passingQuestions.push(evalResult.mcq);
              if (byTier[tier]) byTier[tier].accepted++;

              targetResults.push({
                targetId: currentTarget.targetId,
                concept: currentTarget.concept,
                subtopic: currentTarget.subtopic || 'Core Mechanism',
                targetDifficulty: currentTarget.targetDifficulty,
                intendedCognitiveOperation: currentTarget.intendedCognitiveOperation,
                status: 'ACCEPTED',
                attempts: 1 + (repairAttempted ? 1 : 0),
                repairAttempted,
                repairSuccessful,
                mcq: evalResult.mcq
              });`;

const newMetaBlock = `              if (evalResult.mcq) {
                evalResult.mcq.metadata = {
                  ...(evalResult.mcq.metadata || {}),
                  assessmentAngle: currentTarget.assessmentAngle || 'CONCEPTUAL',
                  formatRecommendation: currentTarget.formatRecommendation || 'PROSE_MULTIPLE_CHOICE',
                  macroTopic: currentTarget.macroTopic || currentTarget.subtopic || 'Core Mechanism'
                };
              }
              passingQuestions.push(evalResult.mcq);
              if (byTier[tier]) byTier[tier].accepted++;

              targetResults.push({
                targetId: currentTarget.targetId,
                concept: currentTarget.concept,
                subtopic: currentTarget.subtopic || 'Core Mechanism',
                macroTopic: currentTarget.macroTopic || currentTarget.subtopic || 'Core Mechanism',
                assessmentAngle: currentTarget.assessmentAngle || 'CONCEPTUAL',
                formatRecommendation: currentTarget.formatRecommendation || 'PROSE_MULTIPLE_CHOICE',
                targetDifficulty: currentTarget.targetDifficulty,
                intendedCognitiveOperation: currentTarget.intendedCognitiveOperation,
                status: 'ACCEPTED',
                attempts: 1 + (repairAttempted ? 1 : 0),
                repairAttempted,
                repairSuccessful,
                mcq: evalResult.mcq
              });`;

if (!code.includes(oldMetaBlock)) {
  throw new Error('Could not find oldMetaBlock in pipelineOrchestrator.js');
}
code = code.replace(oldMetaBlock, newMetaBlock);

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, code, 'utf8');
console.log('✅ Phase E successfully applied to pipelineOrchestrator.js');
