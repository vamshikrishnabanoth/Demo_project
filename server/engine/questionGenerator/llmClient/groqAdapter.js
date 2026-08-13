const Groq = require('groq-sdk');

class GroqAdapter {
  constructor() {
    this.defaultModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    this.capabilities = {
      supportsJSONMode: true,
      maxContextTokens: 8192
    };
    this.client = null;
  }

  getClient(apiKey) {
    const key = apiKey || process.env.GROQ_API_KEY || "dummy_key";
    if (!this.client) {
      this.client = new Groq({ apiKey: key });
    }
    return this.client;
  }

  async generate(promptPayload, signal, config = {}) {
    const systemPrompt = promptPayload.systemPrompt || "You are an expert assessment generator.";
    const userPrompt = promptPayload.userPrompt || "";
    const model = promptPayload.llmParams?.model || this.defaultModel;

    const timeoutMs = config.REQUEST_TIMEOUT_MS || 12000;

    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("TIMEOUT"));
      }, timeoutMs);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error("ABORTED"));
        });
      }
    });

    const client = this.getClient(config.apiKey);

    const apiPromise = client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model,
      response_format: { type: "json_object" },
      temperature: promptPayload.llmParams?.TEMPERATURE || 0.2,
      top_p: promptPayload.llmParams?.TOP_P || 0.9,
      max_tokens: promptPayload.llmParams?.MAX_TOKENS || 700
    });

    const completion = await Promise.race([apiPromise, timeoutPromise]);
    const rawText = completion.choices[0]?.message?.content || "";
    const usage = completion.usage || { completion_tokens: Math.round(rawText.length / 4) };

    return {
      rawText,
      usage,
      model,
      capabilities: this.capabilities
    };
  }
}

module.exports = new GroqAdapter();
