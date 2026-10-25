'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testThinking() {
  const prompt = `[TASK INSTRUCTION]
Generate a complete single grounded multiple-choice question testing the following target:
Concept: Trace the loop that finds the least common multiple by incrementing from 1 upward.
Tier: Medium

Output MUST be a single JSON object with targetId, questionText, options (array of 4 strings), correctAnswerIndex, correctAnswer, explanation.`;

  console.log('--- Test 1: gemini-2.5-flash WITH thinkingBudget: 0 ---');
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    const t0 = Date.now();
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    console.log(`✅ Success in ${Date.now() - t0}ms, length: ${text.length}`);
    console.log('Full JSON response:');
    console.log(text);
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }
}

testThinking();
