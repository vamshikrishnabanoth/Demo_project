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
    const isDb = /crud|mongodb|sql|query|push|gt|lt|update|delete|find|products|stock|manager/i.test(conceptLabel) || promptPayload.userPrompt.includes('DATABASE_QUERY_DOCUMENT');

    let mockResponse;
    if (isDb) {
      mockResponse = {
        status: "SUCCESS",
        stem: `Which query correctly uses the ${conceptLabel} operator to filter or update database records?`,
        options: [
          `db.products.updateMany({}, { ${conceptLabel}: { stock: 20 } })`,
          `db.products.find({ price: { $gt: 10000 } })`,
          `db.users.deleteMany({ status: "inactive" })`,
          `db.customers.updateOne({ id: 101 }, { $push: { cart: "Laptop" } })`
        ],
        correctAnswer: `db.products.updateMany({}, { ${conceptLabel}: { stock: 20 } })`,
        explanation: `The source content specifies ${conceptLabel} as a primary database query operator.`
      };
    } else if (isGit) {
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
        stem: `In software engineering and domain design, what is the primary role of ${conceptLabel}?`,
        options: [
          `Defines the structural model and operational behavior of ${conceptLabel}.`,
          `Specifies low-level hardware memory allocation routines.`,
          `Executes background compilation of binary dependencies.`,
          `Schedules network packet transmission across physical interfaces.`
        ],
        correctAnswer: `Defines the structural model and operational behavior of ${conceptLabel}.`,
        explanation: `The source content specifies ${conceptLabel} as a primary structural element in the system model.`
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
