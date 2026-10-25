'use strict';

const llmRouter = require('../engine/adapter/llmRouter');

async function testGeminiMCQ() {
  const prompt = `[TASK INSTRUCTION]
You are an expert assessment question generator.
Generate a high-quality single multiple-choice question (MCQ) testing the following target:
[ASSESSMENT TARGET]
Target: T03
Concept: Trace the loop that finds the least common multiple by incrementing from 1 upward.
Tier: Medium
Assessment Angle: CALCULATION
Format Recommendation: NUMERICAL_TRACE

Output MUST be a single JSON object strictly matching this schema:
{
  "targetId": "T03",
  "questionText": "Question stem here...",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correctAnswerIndex": 0,
  "correctAnswer": "Option A",
  "explanation": "Detailed explanation..."
}`;

  console.log('Testing llmRouter._callGemini with MCQ prompt...');
  try {
    const res = await llmRouter._callGemini({
      prompt,
      responseFormat: 'json',
      maxTokens: 1800
    });
    console.log('Gemini response type:', typeof res);
    console.log('Gemini response length:', res.length);
    console.log('Gemini response preview:', res.slice(0, 300));
  } catch (err) {
    console.error('Gemini error:', err);
  }
}

testGeminiMCQ();
