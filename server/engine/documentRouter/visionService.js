/**
 * server/engine/documentRouter/visionService.js
 *
 * Multimodal Visual Understanding Engine with Multi-Tier Fallback.
 * Strictly grounds descriptions in observable visual evidence. NEVER fabricates values.
 *
 * Fallback Chain:
 * Primary Vision Model -> Fallback Vision Model -> Local OCR / Text fallback
 */

'use strict';

const axios = require('axios');
const OcrService = require('./ocrService');

class VisionService {
  constructor() {
    this.primaryProvider = process.env.VISION_PROVIDER || 'groq';
    this.primaryModel = process.env.VISION_MODEL || 'llama-3.2-11b-vision-preview';
    this.fallbackProvider = process.env.VISION_FALLBACK_PROVIDER || 'ocr';
    this.fallbackModel = process.env.VISION_FALLBACK_MODEL || 'gemini-2.0-flash';
    this.groqApiKey = process.env.GROQ_API_KEY || null;
    this.geminiApiKey = (process.env.ENABLE_GEMINI_VISION === 'true' && process.env.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : null;
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  }

  /**
   * Generates a structured evidence prompt for the vision model.
   * @param {string} visualCategory - 'chart' | 'diagram' | 'general'
   * @returns {string}
   */
  _buildVisionPrompt(visualCategory = 'general') {
    if (visualCategory === 'chart') {
      return (
        "Analyze this chart image carefully. Output a structured factual description:\n" +
        "- Chart Title: [Exact title if visible]\n" +
        "- Chart Type: [Bar, Line, Pie, Scatter, etc.]\n" +
        "- X-Axis Label & Categories: [Labels]\n" +
        "- Y-Axis Label & Scale: [Scale and units]\n" +
        "- Observable Trends: [Describe increases, decreases, peaks]\n" +
        "- Key Numerical Values: [Report ONLY values that are clearly legible. If any value is blurry or uncertain, state 'UNREADABLE'. DO NOT invent numbers.]\n" +
        "- Educational Takeaway: [Core concept demonstrated]"
      );
    }

    if (visualCategory === 'diagram') {
      return (
        "Analyze this technical diagram / architecture / circuit diagram:\n" +
        "- Diagram Title/Topic: [Title or domain]\n" +
        "- Core Components: [List identifiable blocks, nodes, or entities]\n" +
        "- Connections & Data Flow: [Describe arrows, inputs, outputs, and relationships]\n" +
        "- Key Rules / Logic: [Mechanisms or protocols shown]\n" +
        "- Observational Grounding: [Report ONLY elements directly visible. If text inside a block is illegible, label it 'Illegible block'.]"
      );
    }

    return (
      "Transcribe all text from this image verbatim. " +
      "If equations are present, convert to LaTeX syntax ($...$). " +
      "For diagrams or tables, output a clean Markdown representation. " +
      "Report strictly what is visible. Do NOT invent missing details."
    );
  }

  /**
   * Query Groq Vision API.
   */
  async _callGroqVision(imageBase64, mimeType, prompt, model) {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const payload = {
      model: model || this.primaryModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` }
            }
          ]
        }
      ],
      temperature: 0.1
    };

    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
      headers: {
        Authorization: `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const content = res.data?.choices?.[0]?.message?.content || '';
    if (!content.trim()) throw new Error('Groq Vision returned empty response');
    return content.trim();
  }

  /**
   * Query Gemini Vision API.
   */
  async _callGeminiVision(imageBase64, mimeType, prompt, model) {
    if (!this.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.geminiApiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model || this.fallbackModel });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || 'image/png'
      }
    };

    const result = await geminiModel.generateContent([prompt, imagePart]);
    const text = result?.response?.text() || '';
    if (!text.trim()) throw new Error('Gemini Vision returned empty response');
    return text.trim();
  }

  /**
   * Query Local Ollama Vision API (e.g. llama3.2-vision).
   */
  async _callOllamaVision(imageBase64, prompt, model) {
    const payload = {
      model: model || 'llama3.2-vision',
      prompt: prompt,
      images: [imageBase64],
      stream: false,
      options: { temperature: 0.1 }
    };

    const res = await axios.post(`${this.ollamaUrl}/api/generate`, payload, { timeout: 45000 });
    const content = res.data?.response || '';
    if (!content.trim()) throw new Error('Ollama Vision returned empty response');
    return content.trim();
  }

  /**
   * Describe an image with multi-tier fallback: Primary -> Fallback -> OCR.
   * @param {Buffer|string} imageInput - Buffer or Base64 string
   * @param {string} mimeType - e.g. 'image/png', 'image/jpeg'
   * @param {'chart'|'diagram'|'general'} category
   * @returns {Promise<{ description: string, method: string, isSuccessful: boolean }>}
   */
  async describeImage(imageInput, mimeType = 'image/png', category = 'general') {
    let imageBase64 = '';
    let imageBuffer = null;

    if (Buffer.isBuffer(imageInput)) {
      imageBuffer = imageInput;
      imageBase64 = imageInput.toString('base64');
    } else if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:') && imageInput.includes('base64,')) {
        imageBase64 = imageInput.split('base64,')[1];
      } else if (imageInput.startsWith('base64:')) {
        imageBase64 = imageInput.substring(7);
      } else {
        imageBase64 = imageInput;
      }
      imageBuffer = Buffer.from(imageBase64, 'base64');
    } else {
      return { description: '', method: 'none', isSuccessful: false };
    }

    const prompt = this._buildVisionPrompt(category);

    // 1. Try Primary Vision Provider
    try {
      let desc = '';
      if (this.primaryProvider === 'groq') {
        desc = await this._callGroqVision(imageBase64, mimeType, prompt, this.primaryModel);
      } else if (this.primaryProvider === 'gemini') {
        desc = await this._callGeminiVision(imageBase64, mimeType, prompt, this.primaryModel);
      } else if (this.primaryProvider === 'ollama') {
        desc = await this._callOllamaVision(imageBase64, prompt, this.primaryModel);
      }

      if (desc) {
        return {
          description: desc,
          method: `vision_${this.primaryProvider}`,
          isSuccessful: true
        };
      }
    } catch (primaryErr) {
      console.warn(`⚠️ [VisionService] Primary vision (${this.primaryProvider}) failed: ${primaryErr.message}. Trying fallback...`);
    }

    // 2. Try Fallback Vision Provider
    try {
      let fallbackDesc = '';
      if (this.fallbackProvider === 'gemini') {
        fallbackDesc = await this._callGeminiVision(imageBase64, mimeType, prompt, this.fallbackModel);
      } else if (this.fallbackProvider === 'groq') {
        fallbackDesc = await this._callGroqVision(imageBase64, mimeType, prompt, this.fallbackModel);
      } else if (this.fallbackProvider === 'ollama') {
        fallbackDesc = await this._callOllamaVision(imageBase64, prompt, this.fallbackModel);
      }

      if (fallbackDesc) {
        return {
          description: fallbackDesc,
          method: `vision_${this.fallbackProvider}`,
          isSuccessful: true
        };
      }
    } catch (fallbackErr) {
      console.warn(`⚠️ [VisionService] Fallback vision (${this.fallbackProvider}) failed: ${fallbackErr.message}. Falling back to OCR...`);
    }

    // 3. Fallback to Local Tesseract OCR
    try {
      const ocrRes = await OcrService.recognize(imageBuffer);
      if (ocrRes.isReadable && ocrRes.text) {
        return {
          description: `[TEXT IN IMAGE (OCR)]:\n${ocrRes.text}`,
          method: 'tesseract_ocr',
          confidence: ocrRes.confidence,
          isSuccessful: true
        };
      }
    } catch (ocrErr) {
      console.warn(`⚠️ [VisionService] Local OCR fallback failed: ${ocrErr.message}`);
    }

    return {
      description: '[Visual element present: content could not be legibly resolved]',
      method: 'unreadable',
      isSuccessful: false
    };
  }
}

module.exports = new VisionService();
