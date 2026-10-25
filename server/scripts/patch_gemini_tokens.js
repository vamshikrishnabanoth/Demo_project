'use strict';

const fs = require('fs');
const path = require('path');

const routerPath = path.resolve(__dirname, '../engine/adapter/llmRouter.js');
let code = fs.readFileSync(routerPath, 'utf8');

const isCRLF = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');

// Find _callGemini definition and update its maxTokens
const geminiIdx = norm.indexOf('async _callGemini(');
if (geminiIdx === -1) {
  throw new Error('Could not find _callGemini');
}

const geminiPart = norm.slice(geminiIdx);
const oldTokensPart = `    let resolvedMaxTokens = parseInt(maxTokens, 10);
    if (isNaN(resolvedMaxTokens) || resolvedMaxTokens <= 0) {
      if (prompt.includes('[ASSESSMENT TARGET]') || prompt.includes('candidate MCQ') || prompt.includes('single multiple-choice') || prompt.includes('single grounded')) {
        resolvedMaxTokens = 750; // Calibrated for single MCQ to reduce Groq TPM reservation
      } else if (prompt.includes('Assessment Planner') || prompt.includes('[ACADEMIC TOPIC CURRICULUM SPECIFICATION]') || prompt.includes('[TEACHING EVIDENCE PACKAGE]')) {
        resolvedMaxTokens = 2500;
      } else {
        resolvedMaxTokens = 2048;
      }
    }`;

const newTokensPart = `    let resolvedMaxTokens = parseInt(maxTokens, 10);
    if (isNaN(resolvedMaxTokens) || resolvedMaxTokens <= 0) {
      if (prompt.includes('[ASSESSMENT TARGET]') || prompt.includes('candidate MCQ') || prompt.includes('single multiple-choice') || prompt.includes('single grounded')) {
        resolvedMaxTokens = 2048; // Gemini has generous token windows; allow full MCQ without truncation
      } else if (prompt.includes('Assessment Planner') || prompt.includes('[ACADEMIC TOPIC CURRICULUM SPECIFICATION]') || prompt.includes('[TEACHING EVIDENCE PACKAGE]')) {
        resolvedMaxTokens = 3500;
      } else {
        resolvedMaxTokens = 4096;
      }
    }`;

if (!geminiPart.includes(oldTokensPart)) {
  throw new Error('Could not find oldTokensPart in _callGemini');
}

norm = norm.slice(0, geminiIdx) + geminiPart.replace(oldTokensPart, newTokensPart);

if (isCRLF) {
  norm = norm.replace(/\n/g, '\r\n');
}

fs.writeFileSync(routerPath, norm, 'utf8');
console.log('✅ Successfully patched _callGemini resolvedMaxTokens');
