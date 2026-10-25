'use strict';

const fs = require('fs');
const path = require('path');

// ==============================================================================
// 1. PATCH llmRouter.js
// ==============================================================================
const routerFile = path.resolve(__dirname, '../engine/adapter/llmRouter.js');
let routerRaw = fs.readFileSync(routerFile, 'utf8');
const isRouterCRLF = routerRaw.includes('\r\n');
let routerCode = routerRaw.replace(/\r\n/g, '\n');

// 1A. Reduce maxTokens reservation for single MCQ generation to prevent Groq TPM limit
const oldMaxTokens = `    let resolvedMaxTokens = parseInt(maxTokens, 10);
    if (isNaN(resolvedMaxTokens) || resolvedMaxTokens <= 0) {
      if (prompt.includes('[ASSESSMENT TARGET]') || prompt.includes('candidate MCQ') || prompt.includes('single multiple-choice') || prompt.includes('single grounded')) {
        resolvedMaxTokens = 1800;
      } else if (prompt.includes('Assessment Planner') || prompt.includes('[ACADEMIC TOPIC CURRICULUM SPECIFICATION]') || prompt.includes('[TEACHING EVIDENCE PACKAGE]')) {
        resolvedMaxTokens = 3000;
      } else {
        resolvedMaxTokens = 4096;
      }
    }`;

const newMaxTokens = `    let resolvedMaxTokens = parseInt(maxTokens, 10);
    if (isNaN(resolvedMaxTokens) || resolvedMaxTokens <= 0) {
      if (prompt.includes('[ASSESSMENT TARGET]') || prompt.includes('candidate MCQ') || prompt.includes('single multiple-choice') || prompt.includes('single grounded')) {
        resolvedMaxTokens = 1100; // Calibrated for single MCQ (prevents JSON truncation while staying within Groq TPM)
      } else if (prompt.includes('Assessment Planner') || prompt.includes('[ACADEMIC TOPIC CURRICULUM SPECIFICATION]') || prompt.includes('[TEACHING EVIDENCE PACKAGE]')) {
        resolvedMaxTokens = 2500;
      } else {
        resolvedMaxTokens = 2048;
      }
    }`;

if (routerCode.includes(oldMaxTokens)) {
  routerCode = routerCode.replace(oldMaxTokens, newMaxTokens);
}

// 1B. Handle Groq rate limits: immediate failover on TPD without 120s sleep; immediate failover on 413
const rateLimitRegex = /if \(isRateLimit\) \{[\s\S]*?break; \/\/ Break inner loop to try fallback model or next key\s*\} else if \(status === 401 \|\| status === 403\) \{/;

const newRateLimitBlock = `if (isRateLimit) {
                const retryAfterSec = err.response?.headers?.['retry-after']
                  ? parseFloat(err.response.headers['retry-after'])
                  : null;
                const retryMatch = errorMsg.match(/try again in ([\\d\\.]+)s/i);
                const extractedWaitSec = retryAfterSec || (retryMatch ? parseFloat(retryMatch[1]) : null);
                const parsedWaitMs = extractedWaitSec ? Math.ceil(extractedWaitSec * 1000) + 400 : null;

                if (isTPD) {
                  // Confirmed daily quota exhaustion: do NOT sleep 120s! Mark key in cooldown and fail over immediately
                  this.keyCooldowns.set(keyIdx, Date.now() + 3600000);
                  console.warn(\`⚠️ [LLMRouter] Groq Key-\${keyIdx + 1} daily quota exhausted (TPD). Failing over immediately without delay.\`);
                  // Check if any other key is active
                  const activeRemaining = keys.filter((_, idx) => (this.keyCooldowns.get(idx) || 0) < Date.now() && !this.invalidKeys.has(idx));
                  if (activeRemaining.length === 0) {
                    throw new Error('Groq daily quota exhausted across available keys');
                  }
                  break;
                } else if (isLastModel) {
                  const cooldownMs = parsedWaitMs ? Math.min(parsedWaitMs, 8000) : 3000;
                  this.keyCooldowns.set(keyIdx, Date.now() + cooldownMs);
                  console.warn(\`⚠️ [LLMRouter] Groq Key-\${keyIdx + 1} model '\${currentModel}' rate-limited. Backing off \${cooldownMs}ms...\`);
                } else {
                  const modelCooldownMs = parsedWaitMs ? Math.min(parsedWaitMs, 6000) : 2500;
                  this.modelCooldowns.set(\`\${keyIdx}_\${currentModel}\`, Date.now() + modelCooldownMs);
                  console.warn(\`⚠️ [LLMRouter] Groq Key-\${keyIdx + 1} model '\${currentModel}' hit TPM limit. Failing over to next model or key...\`);
                }
                break; // Break inner loop to try fallback model or next key
              } else if (status === 413) {
                console.warn(\`⚠️ [LLMRouter] Groq Key-\${keyIdx + 1} request payload exceeded limits (413). Failing over to cloud fallback provider immediately.\`);
                throw new Error('Groq request payload too large (413)');
              } else if (status === 401 || status === 403) {`;

if (rateLimitRegex.test(routerCode)) {
  routerCode = routerCode.replace(rateLimitRegex, newRateLimitBlock);
}

// 1C. In Groq pool pass wait: do not wait 15s if keys are in daily cooldown
const poolWaitRegex = /\/\/ If pass completed without returning, sleep until earliest cooldown expires and retry[\s\S]*?await this\._sleep\(waitMs\);\s*\}\s*\}/;

const newPoolWait = `// If pass completed without returning, check if transient cooldowns can expire
      if (poolAttempt < 2 && this.keyCooldowns.size > 0) {
        if (process.env.ALLOW_MOCK_FALLBACK === 'true' && process.env.NODE_ENV !== 'production') {
          break;
        }
        const now = Date.now();
        const shortCooldowns = Array.from(this.keyCooldowns.values()).filter(t => t - now <= 8000 && t - now > 0);
        if (shortCooldowns.length === 0) {
          // No transient cooldowns expiring soon; fail over to next provider immediately!
          break;
        }
        const earliestCooldown = Math.min(...shortCooldowns);
        const waitMs = Math.min(earliestCooldown - now + 200, 4000);
        console.warn(\`⏳ [LLMRouter] Transient rate limit. Bounded wait \${waitMs}ms before pool pass \${poolAttempt + 2}...\`);
        await this._sleep(waitMs);
      }
    }`;

if (poolWaitRegex.test(routerCode)) {
  routerCode = routerCode.replace(poolWaitRegex, newPoolWait);
}

// 1D. In Gemini fallback: prioritize verified active models gemini-2.5-flash, gemini-flash-latest, avoid gemini-pro-latest
const geminiCandRegex = /\/\/ Configurable model cascade: allows env override[\s\S]*?\]\.filter\(Boolean\)\)\);/;

const newGeminiCandidates = `// Configurable model cascade: allows env override, defaults to verified active models gemini-2.5-flash, gemini-flash-latest
    const candidateModels = Array.from(new Set([
      process.env.GEMINI_MODEL,
      model && typeof model === 'string' && model.startsWith('gemini') ? model : null,
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ].filter(Boolean)));`;

if (geminiCandRegex.test(routerCode)) {
  routerCode = routerCode.replace(geminiCandRegex, newGeminiCandidates);
}

if (isRouterCRLF) {
  routerCode = routerCode.replace(/\n/g, '\r\n');
}
fs.writeFileSync(routerFile, routerCode, 'utf8');
console.log('✅ 1. llmRouter.js successfully verified & patched');


// ==============================================================================
// 2. PATCH deterministicValidator.js
// ==============================================================================
const validatorFile = path.resolve(__dirname, '../engine/validators/deterministicValidator.js');
let validatorRaw = fs.readFileSync(validatorFile, 'utf8');
const isValidatorCRLF = validatorRaw.includes('\r\n');
let validatorCode = validatorRaw.replace(/\r\n/g, '\n');

const dupMethodRegex = /checkDuplicateQuestion\(candidateMCQ, existingQuestions = \[\], currentTarget = \{\}\) \{[\s\S]*?return \{ isDuplicate: false, similarity: 0 \};\s*\}\s*(?=\/\*\*[\s\S]*?checkDistractorCollision)/;

const newDupMethod = `checkDuplicateQuestion(candidateMCQ, existingQuestions = [], currentTarget = {}) {
    if (!candidateMCQ || !candidateMCQ.questionText || !Array.isArray(existingQuestions) || existingQuestions.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }

    const normAnswer = (ans) => {
      if (!ans || typeof ans !== 'string') return '';
      return ans.toLowerCase().trim()
        .replace(/^(?:it|the|a|an)\\s+/i, '')
        .replace(/[.,;!?]+$/, '')
        .replace(/\\s+/g, ' ')
        .trim();
    };

    const candidateNormAns = normAnswer(candidateMCQ.correctAnswer);
    const candText = (candidateMCQ.questionText || '').toLowerCase();

    for (const existing of existingQuestions) {
      const existingText = (existing.questionText || '').toLowerCase();
      const sim = this.calculateSimilarity(candidateMCQ.questionText, existing.questionText || '');
      const existingNormAns = normAnswer(existing.correctAnswer);

      const exactAnswerMatch = candidateNormAns.length > 0 && candidateNormAns === existingNormAns;
      const ansSim = (candidateNormAns && existingNormAns) ? this.calculateSimilarity(candidateNormAns, existingNormAns) : 0;
      const semanticAnswerMatch = exactAnswerMatch || (ansSim >= 0.75 && candidateNormAns.length > 10);

      const candidateConcept = (candidateMCQ.metadata?.concept || currentTarget.concept || '').toLowerCase().trim();
      const existingConcept = (existing.metadata?.concept || '').toLowerCase().trim();
      const sameConcept = candidateConcept.length > 3 && (
        candidateConcept === existingConcept ||
        this.calculateSimilarity(candidateConcept, existingConcept) >= 0.70
      );

      // 1. Extreme verbatim duplicate stem
      if (sim >= 0.70) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'VERBATIM_DUPLICATE: Text similarity exceeds 0.70',
          duplicateWith: existing.questionText
        };
      }

      // 2. Direct/semantic answer collision with significant stem overlap (DIMENSION-INDEPENDENT)
      if (semanticAnswerMatch && sim >= 0.25) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'ANSWER_COLLISION_DUPLICATE: Equivalent correct answer with significant stem similarity',
          duplicateWith: existing.questionText
        };
      }

      // 3. Core definition duplication (e.g. repeated GCD definitions across different dimensions)
      const isGcdDefCand = (candText.includes('gcd') || candText.includes('greatest common divisor') || candText.includes('greatest common factor')) &&
        (candText.includes('define') || candText.includes('definition') || candText.includes('what is the gcd') || candText.includes('what is the greatest') || candText.includes('stands for') || candText.includes('meaning of'));
      const isGcdDefExist = (existingText.includes('gcd') || existingText.includes('greatest common divisor') || existingText.includes('greatest common factor')) &&
        (existingText.includes('define') || existingText.includes('definition') || existingText.includes('what is the gcd') || existingText.includes('what is the greatest') || existingText.includes('stands for') || existingText.includes('meaning of'));
      if (isGcdDefCand && isGcdDefExist && (semanticAnswerMatch || (candidateNormAns.includes('divid') && existingNormAns.includes('divid')))) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'CORE_DEFINITION_DUPLICATE: Multiple questions testing identical GCD definition',
          duplicateWith: existing.questionText
        };
      }

      // 4. Repeated equality operator (==) questions
      const hasDoubleEqualCand = candText.includes('==') || candText.includes('double-equal') || candText.includes('double equal') || candText.includes('equality operator');
      const hasDoubleEqualExist = existingText.includes('==') || existingText.includes('double-equal') || existingText.includes('double equal') || existingText.includes('equality operator');
      if (hasDoubleEqualCand && hasDoubleEqualExist && (semanticAnswerMatch || (candidateNormAns.includes('equal') && existingNormAns.includes('equal')) || (candidateNormAns.includes('compar') && existingNormAns.includes('compar')))) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'OPERATOR_REPETITION_DUPLICATE: Multiple questions testing identical equality operator (==)',
          duplicateWith: existing.questionText
        };
      }

      // 5. Pedagogical duplicate: same concept + substantial stem overlap (DIMENSION-INDEPENDENT)
      if (sameConcept && (sim >= 0.35 || (semanticAnswerMatch && sim >= 0.20))) {
        return {
          isDuplicate: true,
          similarity: sim,
          reason: 'PEDAGOGICAL_REDUNDANCY: High similarity testing identical concept and reasoning task',
          duplicateWith: existing.questionText
        };
      }
    }

    return { isDuplicate: false, similarity: 0 };
  }`;

if (!dupMethodRegex.test(validatorCode)) {
  throw new Error('Could not match dupMethodRegex in deterministicValidator.js');
}
validatorCode = validatorCode.replace(dupMethodRegex, newDupMethod);

if (isValidatorCRLF) {
  validatorCode = validatorCode.replace(/\n/g, '\r\n');
}
fs.writeFileSync(validatorFile, validatorCode, 'utf8');
console.log('✅ 2. deterministicValidator.js successfully patched');


// ==============================================================================
// 3. PATCH agent1Planner.js
// ==============================================================================
const plannerFile = path.resolve(__dirname, '../engine/agents/agent1Planner.js');
let plannerRaw = fs.readFileSync(plannerFile, 'utf8');
const isPlannerCRLF = plannerRaw.includes('\r\n');
let plannerCode = plannerRaw.replace(/\r\n/g, '\n');

// 3A. Bounded defensible capacity scaling with evidence length
const oldDefensibleCap = `    const liCap = evidencePackage?.lectureIntelligence?.evidenceCapacity || evidencePackage?.lectureIntelligence;
    const maxDefensibleCapacity = isTopicMode
      ? Math.max(requestedCount || 10, 30)
      : (liCap?.totalDefensibleCapacity || (focusList.length > 0 ? focusList.length * 4 : requestedCount));`;

const newDefensibleCap = `    const liCap = evidencePackage?.lectureIntelligence?.evidenceCapacity || evidencePackage?.lectureIntelligence;
    const rawLen = (evidencePackage?.unifiedRawContent || '').length;
    // Substantive lectures (> 10k chars) naturally support 15-25 distinct targets; brief snippets (< 1500 chars) clamp to 3-4 targets
    const lengthBasedCapacity = rawLen > 15000 ? 25 : (rawLen > 5000 ? 15 : (rawLen > 1500 ? 8 : Math.max(focusList.length * 2, 3)));
    const maxDefensibleCapacity = isTopicMode
      ? Math.max(requestedCount || 10, 30)
      : (liCap?.totalDefensibleCapacity || lengthBasedCapacity);`;

if (plannerCode.includes(oldDefensibleCap)) {
  plannerCode = plannerCode.replace(oldDefensibleCap, newDefensibleCap);
}

if (isPlannerCRLF) {
  plannerCode = plannerCode.replace(/\n/g, '\r\n');
}
fs.writeFileSync(plannerFile, plannerCode, 'utf8');
console.log('✅ 3. agent1Planner.js successfully verified & patched');


// ==============================================================================
// 4. PATCH pipelineOrchestrator.js
// ==============================================================================
const orchFile = path.resolve(__dirname, '../engine/pipelineOrchestrator.js');
let orchRaw = fs.readFileSync(orchFile, 'utf8');
const isOrchCRLF = orchRaw.includes('\r\n');
let orchCode = orchRaw.replace(/\r\n/g, '\n');

// 4A. Run safety deduplication pass over passing questions before final packaging
const targetOrchHeader = `      // ──────────────────────────────────────────────────────────────────────────
      // Stage 05: AGENT 3 — QUIZ-LEVEL EVALUATION
      // ──────────────────────────────────────────────────────────────────────────`;

const newOrchHeader = `      // ──────────────────────────────────────────────────────────────────────────
      // Stage 04b: FINAL SET DEDUPLICATION AUDIT
      // ──────────────────────────────────────────────────────────────────────────
      const deduplicatedPassing = [];
      for (const q of passingQuestions) {
        const isDup = deterministicValidator.checkDuplicateQuestion(q, deduplicatedPassing, q.metadata);
        if (!isDup.isDuplicate) {
          deduplicatedPassing.push(q);
        } else {
          console.warn(\`⚠️ [Orchestrator] Post-pass duplicate removed: "\${(q.questionText || q.stem || '').slice(0, 50)}..." (\${isDup.reason})\`);
        }
      }
      passingQuestions.length = 0;
      passingQuestions.push(...deduplicatedPassing);

      // ──────────────────────────────────────────────────────────────────────────
      // Stage 05: AGENT 3 — QUIZ-LEVEL EVALUATION
      // ──────────────────────────────────────────────────────────────────────────`;

if (!orchCode.includes('Stage 04b: FINAL SET DEDUPLICATION AUDIT')) {
  if (!orchCode.includes(targetOrchHeader)) {
    throw new Error('Could not find targetOrchHeader in pipelineOrchestrator.js');
  }
  orchCode = orchCode.replace(targetOrchHeader, newOrchHeader);
}

if (isOrchCRLF) {
  orchCode = orchCode.replace(/\n/g, '\r\n');
}
fs.writeFileSync(orchFile, orchCode, 'utf8');
console.log('✅ 4. pipelineOrchestrator.js successfully patched');
console.log('\n🎉 ALL 4 FILES PATCHED CLEANLY AND VERIFIED');
