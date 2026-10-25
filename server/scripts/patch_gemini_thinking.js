'use strict';

const fs = require('fs');
const path = require('path');

const routerPath = path.resolve(__dirname, '../engine/adapter/llmRouter.js');
let code = fs.readFileSync(routerPath, 'utf8');

const isCRLF = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');

// Find modelConfig in _callGemini
const targetConfig = `        const modelConfig = {
          model: geminiModelName,
          generationConfig: {
            temperature: typeof temperature === 'number' ? temperature : 0.3,
            maxOutputTokens: resolvedMaxTokens
          }
        };

        if (responseFormat === 'json') {
          modelConfig.generationConfig.responseMimeType = 'application/json';
        }`;

const newConfig = `        const modelConfig = {
          model: geminiModelName,
          generationConfig: {
            temperature: typeof temperature === 'number' ? temperature : 0.3,
            maxOutputTokens: 8192
          }
        };

        if (responseFormat === 'json') {
          modelConfig.generationConfig.responseMimeType = 'application/json';
        }

        // For Gemini 2.5 thinking models, disable hidden thinking tokens so full output budget is preserved for structured JSON
        if (geminiModelName.includes('2.5') || geminiModelName.includes('thinking')) {
          modelConfig.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }`;

if (!norm.includes(targetConfig)) {
  throw new Error('Could not find targetConfig in _callGemini');
}

norm = norm.replace(targetConfig, newConfig);

if (isCRLF) {
  norm = norm.replace(/\n/g, '\r\n');
}

fs.writeFileSync(routerPath, norm, 'utf8');
console.log('✅ Successfully added thinkingBudget: 0 and maxOutputTokens: 8192 to Gemini in llmRouter.js');
