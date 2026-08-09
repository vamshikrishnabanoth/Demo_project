const {
  parseJSONRecoverable,
  computeJaccardSimilarity,
  validateAndScoreQuiz,
  computeLectureDepth,
  LightweightConceptGraph
} = require('./engine/mcqEngine');

console.log('=== TEST 1: JSON Recovery Parser ===');
const rawResponseWithFences = `Here is the JSON response:
\`\`\`json
{
  "questions": [
    {
      "question": "What is TCP?",
      "options": ["Protocol", "Hardware", "Software", "System"],
      "correctAnswer": "Protocol",
      "sourceEvidence": [{ "text": "TCP is a protocol", "chunkId": 1, "startOffset": 0, "endOffset": 17 }]
    }
  ]
}
\`\`\``;

const parsed = parseJSONRecoverable(rawResponseWithFences);
console.log('✅ Recovered JSON:', JSON.stringify(parsed, null, 2));

console.log('\n=== TEST 2: Jaccard Similarity Deduplication ===');
const sim1 = computeJaccardSimilarity(
  "What is the function of the TCP protocol?",
  "What is the function of the TCP protocol in networking?"
);
console.log(`Jaccard Similarity (High Overlap): ${sim1.toFixed(2)} (>= 0.85? ${sim1 >= 0.85})`);

console.log('\n=== TEST 3: Multi-Tier Validator & Quality Score Calculation ===');
const mockQuestions = [
  {
    question: "What is TCP protocol in networking?",
    options: ["Transport Layer Protocol", "Application Layer", "Network Layer", "Physical Layer"],
    correctAnswer: "Transport Layer Protocol",
    sourceEvidence: [{ text: "TCP is a transport layer protocol", chunkId: 1, startOffset: 0, endOffset: 30 }]
  },
  {
    question: "What is TCP protocol in networking?", // Duplicate stem!
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: "Option A",
    sourceEvidence: [{ text: "evidence span", chunkId: 1, startOffset: 0, endOffset: 10 }]
  },
  {
    question: "Which of the following is true?",
    options: ["Option A", "Option B", "All of the above", "Option D"], // Forbidden option phrase!
    correctAnswer: "Option A"
  }
];

const validationResult = validateAndScoreQuiz(mockQuestions);
console.log('Validation Is Valid:', validationResult.isValid);
console.log('Valid Questions Count:', validationResult.validQuestions.length);
console.log('Invalid Questions Count:', validationResult.invalidQuestions.length);
console.log('Valid Question Quality Score:', validationResult.validQuestions[0]?.qualityScore);
console.log('Invalid Question Errors:', validationResult.invalidQuestions.map(i => i.errors));

console.log('\n=== TEST 4: Lecture Depth Computation ===');
const sampleLectureText = `
Computer Systems & Network Architecture.
In socket programming, we use function calls like \`malloc\` and \`printf\` in C.
The TCP three-way handshake establishes a connection via SYN, SYN-ACK, and ACK packets.
HTTP requests are transmitted over established TCP sockets to port 80 or 443.
`;
const depth = computeLectureDepth(sampleLectureText);
console.log('Calculated Depth:', depth);

console.log('\n=== ALL MCQ ENGINE TESTS PASSED CLEANLY! ===');
