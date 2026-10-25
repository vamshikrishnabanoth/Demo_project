'use strict';

const fs = require('fs');
const path = require('path');

const routerPath = path.resolve(__dirname, '../engine/adapter/llmRouter.js');
let code = fs.readFileSync(routerPath, 'utf8');

const isCRLF = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');

const oldGemini429 = `        if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
          this.geminiCooldownUntil = Date.now() + 60000;
          console.warn(\`⚠️ [LLMRouter] Gemini hit rate limit (429). Setting 60s cooldown.\`);
          break; // Don't burn requests across models if key is throttled`;

const newGemini429 = `        if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
          const cooldownMs = 3000;
          this.geminiCooldownUntil = Date.now() + cooldownMs;
          console.warn(\`⚠️ [LLMRouter] Gemini hit transient rate limit (429). Bounded cooldown \${cooldownMs}ms...\`);
          await this._sleep(cooldownMs);
          continue; // Try next candidate model in cascade`;

if (!norm.includes(oldGemini429)) {
  throw new Error('Could not find oldGemini429 in llmRouter.js');
}

norm = norm.replace(oldGemini429, newGemini429);

if (isCRLF) {
  norm = norm.replace(/\n/g, '\r\n');
}

fs.writeFileSync(routerPath, norm, 'utf8');
console.log('✅ Successfully updated Gemini 429 to bounded 3s retry');
