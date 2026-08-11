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

    console.warn("⚠️ [MockAdapter] Running in offline mock mode. Set GROQ_API_KEY in server/.env to activate live Llama-3 AI generation.");

    const conceptLabel = promptPayload.userPrompt.match(/Target Concept:\s*"([^"]+)"/)?.[1] || "Concept";
    const isGit = /git|commit|branch|merge|push|pull|repository|remote/i.test(conceptLabel);

    let mockResponse;
    if (isGit) {
      mockResponse = {
        status: "SUCCESS",
        stem: `In version control workflows, what is the primary role of ${conceptLabel}?`,
        options: [
          `Manages commit history and working tree states for ${conceptLabel}.`,
          `Configures remote network socket listeners for file transfer.`,
          `Compiles binary executable files prior to deployment.`,
          `Deletes untracked temporary build artifacts automatically.`
        ],
        correctAnswer: `Manages commit history and working tree states for ${conceptLabel}.`,
        explanation: `The source material defines ${conceptLabel} as a core version control mechanism for tracking repository changes.`
      };
    } else {
      mockResponse = {
        status: "SUCCESS",
        stem: `Which of the following best describes the key function of ${conceptLabel}?`,
        options: [
          `Core mechanism governing ${conceptLabel} operations.`,
          `Secondary protocol configuration for external services.`,
          `Legacy database schema table definition.`,
          `Unrelated background process scheduler.`
        ],
        correctAnswer: `Core mechanism governing ${conceptLabel} operations.`,
        explanation: `The source content specifies ${conceptLabel} as a primary component in the overall system architecture.`
      };
    }

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
