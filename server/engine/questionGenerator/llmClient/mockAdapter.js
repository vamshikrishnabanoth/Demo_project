class MockAdapter {
  constructor() {
    this.defaultModel = "mock-mcq-engine-v1";
    this.capabilities = {
      supportsJSONMode: true,
      maxContextTokens: 8192
    };
  }

  async generate(promptPayload, signal, config = {}) {
    await new Promise(r => setTimeout(r, 50));

    const conceptLabel = promptPayload.userPrompt.match(/Target Concept:\s*"([^"]+)"/)?.[1] || "Concept";

    const mockResponse = {
      status: "SUCCESS",
      stem: `Which of the following best defines the primary function of ${conceptLabel}?`,
      options: [
        `Primary mechanism regulating ${conceptLabel} operations.`,
        `Alternative secondary protocol configuration.`,
        `Legacy database table query definition.`,
        `Unrelated hardware network interface.`
      ],
      correctAnswer: `Primary mechanism regulating ${conceptLabel} operations.`,
      explanation: `The source snippet defines ${conceptLabel} as a primary mechanism for system operation.`
    };

    const rawText = JSON.stringify(mockResponse, null, 2);

    return {
      rawText,
      usage: { completion_tokens: 120 },
      model: this.defaultModel,
      capabilities: this.capabilities
    };
  }
}

module.exports = new MockAdapter();
