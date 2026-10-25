'use strict';

const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../engine/agents/agent3Evaluator.js');
let raw = fs.readFileSync(targetFile, 'utf8');
const isCRLF = raw.includes('\r\n');
let code = raw.replace(/\r\n/g, '\n');

// 1. Add format alignment check in evaluateQuestion
const metaCheckBlock = `    // 3e. Anti-Meta-Question Defect Check (Topic Mode)
    const metaCheckRegex = /\\b(course material|technical reference|provided technical reference|identified in the course|mentioned in the course|listed in the course|covered in the syllabus|three algorithmic paradigms)\\b/i;
    if (isTopicMode && (metaCheckRegex.test(candidateMCQ.questionText || '') || metaCheckRegex.test(candidateMCQ.correctAnswer || ''))) {
      if (!failureReasons.includes(EVALUATOR_FAILURE_CODES.PEDAGOGICAL_DEFECT)) {
        failureReasons.push(EVALUATOR_FAILURE_CODES.PEDAGOGICAL_DEFECT);
      }
    }`;

const formatAlignmentBlock = `    // 3e. Anti-Meta-Question Defect Check (Topic Mode)
    const metaCheckRegex = /\\b(course material|technical reference|provided technical reference|identified in the course|mentioned in the course|listed in the course|covered in the syllabus|three algorithmic paradigms)\\b/i;
    if (isTopicMode && (metaCheckRegex.test(candidateMCQ.questionText || '') || metaCheckRegex.test(candidateMCQ.correctAnswer || ''))) {
      if (!failureReasons.includes(EVALUATOR_FAILURE_CODES.PEDAGOGICAL_DEFECT)) {
        failureReasons.push(EVALUATOR_FAILURE_CODES.PEDAGOGICAL_DEFECT);
      }
    }

    // 3f. Format Alignment Gate (Phase D)
    const formatRec = String(target.formatRecommendation || '').toUpperCase();
    const qText = String(candidateMCQ.questionText || candidateMCQ.question || '');
    const hasCodeSnippet = qText.includes('\`\`\`') ||
      (Array.isArray(candidateMCQ.options) && candidateMCQ.options.some(o => typeof o === 'string' && o.includes('\`\`\`')));

    if (formatRec === 'PROSE_MULTIPLE_CHOICE' && hasCodeSnippet) {
      if (!failureReasons.includes('FORMAT_MISMATCH_UNWANTED_CODE')) {
        failureReasons.push('FORMAT_MISMATCH_UNWANTED_CODE');
      }
    } else if (formatRec === 'CODE_ANALYSIS' && !hasCodeSnippet && !qText.includes('def ') && !qText.includes('function ') && !qText.includes('class ') && !qText.includes('int ')) {
      if (!failureReasons.includes('FORMAT_MISMATCH_MISSING_CODE')) {
        failureReasons.push('FORMAT_MISMATCH_MISSING_CODE');
      }
    }`;

if (!code.includes(metaCheckBlock)) {
  throw new Error('Could not find metaCheckBlock in evaluateQuestion');
}
code = code.replace(metaCheckBlock, formatAlignmentBlock);

// 2. Add format repair instructions in _synthesizeRepairInstruction
const synthStart = `  _synthesizeRepairInstruction(failureReasons = [], candidateMCQ = {}, target = {}) {
    const instructions = [];`;

const synthWithFormat = `  _synthesizeRepairInstruction(failureReasons = [], candidateMCQ = {}, target = {}) {
    const instructions = [];
    if (failureReasons.includes('FORMAT_MISMATCH_UNWANTED_CODE')) {
      instructions.push('Format alignment: Remove code block/snippet. Present as conceptual multiple-choice prose without programming code.');
    }
    if (failureReasons.includes('FORMAT_MISMATCH_MISSING_CODE')) {
      instructions.push('Format alignment: Include a clean 3-7 line code snippet for algorithmic analysis or state tracing.');
    }`;

if (!code.includes(synthStart)) {
  throw new Error('Could not find _synthesizeRepairInstruction start');
}
code = code.replace(synthStart, synthWithFormat);

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, code, 'utf8');
console.log('✅ Phase D successfully applied to agent3Evaluator.js');
