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
    const isAggregation = /\$group|\$unwind|\$lookup|\$addFields|\$switch|\$facet|ixscan|collscan|aggregation|index/i.test(conceptLabel) || promptPayload.userPrompt.includes('$group') || promptPayload.userPrompt.includes('IXSCAN');
    const isGit = /git|commit|branch|merge|push|pull|repository|remote/i.test(conceptLabel);
    const isDb = isAggregation || /crud|mongodb|sql|query|push|gt|lt|update|delete|find|products|stock|manager|restaurants|aggregation|index|collscan|ixscan/i.test(conceptLabel) || promptPayload.userPrompt.includes('DATABASE_QUERY_DOCUMENT');

    let mockResponse;
    if (isAggregation) {
      const validOps = ['group', 'unwind', 'lookup', 'addfields', 'switch', 'match', 'collscan', 'ixscan'];
      const rawClean = conceptLabel.toLowerCase().replace(/[^a-z0-9_$]/g, '');
      let stageName = rawClean.startsWith('$') ? rawClean : `$${rawClean}`;
      if (!validOps.some(v => stageName.includes(v)) || stageName.includes('aggregation') || stageName.includes('indexing')) {
        stageName = '$group';
      }
      mockResponse = {
        status: "SUCCESS",
        stem: `Which query correctly constructs an aggregation pipeline stage using ${conceptLabel}?`,
        options: [
          `db.restaurants.aggregate([ { ${stageName}: { _id: "$cuisine" } } ])`,
          `db.restaurants.aggregate([ { $unwind: "$grades" } ])`,
          `db.restaurants.aggregate([ { $addFields: { normalizedScore: 1 } } ])`,
          `db.restaurants.aggregate([ { $lookup: { from: "reviews", localField: "_id", foreignField: "restaurant_id", as: "rev" } } ])`
        ],
        correctAnswer: `db.restaurants.aggregate([ { ${stageName}: { _id: "$cuisine" } } ])`,
        explanation: `The source material specifies ${conceptLabel} as a core aggregation pipeline operator in MongoDB.`
      };
    } else if (isDb) {
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
    } else if (/rnn|cnn|ann|neural|lstm|gru|deep learning|sequential|weight|matrix|gradient|loss|backprop|intelligence|ai|ml|learning|model|algorithm|representation|vision|nlp|search/i.test(conceptLabel)) {
      mockResponse = {
        status: "SUCCESS",
        stem: `In artificial intelligence and deep learning architecture, what is the primary role of ${conceptLabel}?`,
        options: [
          `Maintains feature representations and computational mechanisms for ${conceptLabel}.`,
          `Processes linear matrix transformations for feedforward state evaluation.`,
          `Applies non-linear activation bounds to regulate gradient magnitude.`,
          `Stores historical context weights across sequential time steps.`
        ],
        correctAnswer: `Maintains feature representations and computational mechanisms for ${conceptLabel}.`,
        explanation: `The source document specifies ${conceptLabel} as a fundamental AI mechanism for concept modeling.`
      };
    } else {
      const stemVariations = [
        `What is the primary function of ${conceptLabel} within the system domain?`,
        `How does ${conceptLabel} contribute to core operational functionality?`,
        `In architectural analysis, which statement best characterizes ${conceptLabel}?`,
        `When evaluating system design, what role does ${conceptLabel} perform?`
      ];
      const selectedStem = stemVariations[Math.floor(Math.random() * stemVariations.length)];
      mockResponse = {
        status: "SUCCESS",
        stem: selectedStem,
        options: [
          `Defines the structural model and domain behavior of ${conceptLabel}.`,
          `Provides operational constraints and boundary definitions for ${conceptLabel}.`,
          `Manages data integration and interface synchronization for ${conceptLabel}.`,
          `Evaluates performance metrics and execution flow for ${conceptLabel}.`
        ],
        correctAnswer: `Defines the structural model and domain behavior of ${conceptLabel}.`,
        explanation: `The source content specifies ${conceptLabel} as a primary structural element in the domain model.`
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
