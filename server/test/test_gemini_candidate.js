'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    });
    const t0 = Date.now();
    const res = await model.generateContent('Return JSON: {"status": "ok", "model": "' + modelName + '"}');
    console.log(`✅ [${modelName}] SUCCEEDED in ${Date.now() - t0}ms:`, res.response.text().trim());
    return true;
  } catch (err) {
    console.log(`❌ [${modelName}] FAILED:`, err.message.slice(0, 120));
    return false;
  }
}

async function run() {
  console.log('Testing candidate Gemini models for fallback cascade:');
  await testModel('gemini-2.5-flash');
  await testModel('gemini-flash-latest');
  await testModel('gemini-2.0-flash-exp');
}

run();
