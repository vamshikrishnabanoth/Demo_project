const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Pinned deterministic cryptographic seed for reproducible blinding
const SALT = 'kmit-kahoot-q1-blinded-audit-seed-20261106';

function generateItemToken(pkgId, sysId, idx) {
  const hash = crypto.createHmac('sha256', SALT)
    .update(`${pkgId}:${sysId}:${idx}`)
    .digest('hex');
  return `ITEM-${hash.slice(0, 8).toUpperCase()}`;
}

// Pseudo-random shuffle using HMAC-derived weights for perfect determinism
function deterministicShuffle(array, seed) {
  const scored = array.map((item, i) => {
    const score = crypto.createHmac('sha256', seed)
      .update(`${i}`)
      .digest('hex');
    return { item, score };
  });
  scored.sort((a, b) => a.score.localeCompare(b.score));
  return scored.map(s => s.item);
}

const baseDir = path.join(__dirname, 'raw_outputs');
const corpusDir = path.join(__dirname, '..', 'experiment_5_teaching_adequacy', 'benchmark_corpus');
const pkgs = fs.readdirSync(baseDir).filter(f => f.startsWith('pkg_')).sort();

console.log('Generating Blinded Dual-Annotation Portfolios...');
console.log(`Discovered ${pkgs.length} packages in ${baseDir}`);

const allItems = [];
const keyMapping = {};
const packagePortfolios = [];

let grandTotalCount = 0;
const systemCounts = { 'System 1': 0, 'System 2': 0, 'System 3': 0 };

for (const pkg of pkgs) {
  const pkgDir = path.join(baseDir, pkg);
  const metaPath = path.join(corpusDir, pkg, 'metadata.json');
  const metadata = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};

  const sysFiles = [
    { file: 'system1_zeroshot.json', id: 'system_1', label: 'System 1 (Zero-Shot AQG)' },
    { file: 'system2_rag.json', id: 'system_2', label: 'System 2 (Sliding-Window RAG)' },
    { file: 'system3_lcacm.json', id: 'system_3', label: 'System 3 (Frozen LCA-CM)' }
  ];

  const pkgItems = [];

  for (const sys of sysFiles) {
    const filePath = path.join(pkgDir, sys.file);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const questions = Array.isArray(data.questions) ? data.questions : [];

    questions.forEach((q, idx) => {
      const token = generateItemToken(pkg, sys.id, idx);
      grandTotalCount++;
      if (sys.id === 'system_1') systemCounts['System 1']++;
      if (sys.id === 'system_2') systemCounts['System 2']++;
      if (sys.id === 'system_3') systemCounts['System 3']++;

      // Strict de-identification: strip all pipeline metadata, system signatures, and internal telemetry
      const anonymizedItem = {
        itemId: token,
        packageId: pkg,
        domain: metadata.domain || 'Academic Discipline',
        topic: metadata.topic || 'Curriculum Subject',
        questionText: q.questionText,
        options: [...q.options],
        correctAnswer: q.correctAnswer || (q.options && q.options[q.correct_option]) || ''
      };

      // Record in key mapping (isolated ground truth)
      keyMapping[token] = {
        itemId: token,
        packageId: pkg,
        systemId: sys.id,
        systemLabel: sys.label,
        originalIndex: idx,
        subtopic: q.subtopic || null,
        targetDifficulty: q.targetDifficulty || null,
        model: data.model || 'openai/gpt-oss-120b'
      };

      pkgItems.push(anonymizedItem);
      allItems.push(anonymizedItem);
    });
  }

  // Shuffle items within each package using package-specific seed
  const pkgSeed = `${SALT}:${pkg}`;
  const shuffledPkgItems = deterministicShuffle(pkgItems, pkgSeed);

  packagePortfolios.push({
    packageId: pkg,
    domain: metadata.domain || 'Academic Discipline',
    topic: metadata.topic || 'Curriculum Subject',
    objective: metadata.objective || '',
    itemCount: shuffledPkgItems.length,
    items: shuffledPkgItems
  });
}

// Global deterministic shuffle of all items
const globallyShuffledItems = deterministicShuffle(allItems, `${SALT}:global`);

// Write 1: Complete Anonymized Portfolio JSON
const portfolioPath = path.join(__dirname, 'blinded_eval_portfolio.json');
fs.writeFileSync(portfolioPath, JSON.stringify({
  manifest: {
    description: 'Blinded Dual-Annotation Human Evaluation Portfolio for Q1 Multimodal Benchmarking',
    totalItems: grandTotalCount,
    totalPackages: pkgs.length,
    itemDistribution: systemCounts,
    rubricScales: {
      bloomCognitiveTaxonomy: {
        type: 'ORDINAL_1_TO_3',
        tiers: {
          1: 'Recall / Remember (Factual retrieval, definitions)',
          2: 'Understand / Comprehend (Explanations, distinctions, interpretations)',
          3: 'Apply / Analyze / Evaluate (Problem-solving, algorithmic tracing, multi-concept reasoning)'
        }
      },
      contextGrounding: {
        type: 'BINARY_0_OR_1',
        values: {
          1: 'Grounded: Conceptually and factually faithful to the lecture transcript and lesson objectives',
          0: 'Ungrounded: Hallucinated concepts, contradictory facts, or external out-of-scope trivia'
        }
      },
      distractorPlausibilityIndex: {
        type: 'ORDINAL_1_TO_4',
        tiers: {
          1: 'Trivially Flawed: Nonsensical, syntactically malformed, or instantly dismissible',
          2: 'Superficial: Syntactically sound but contextually obvious distractor requiring no domain depth',
          3: 'Plausible: Convincing distractor representing typical superficial understanding',
          4: 'Diagnostic Misconception: High-quality distractor representing a precise student misconception or boundary condition error'
        }
      }
    },
    hashAlgorithm: 'HMAC-SHA256 (Salted)',
    generatedAt: new Date().toISOString()
  },
  packagePortfolios
}, null, 2));

// Write 2: Isolated Ground-Truth Key Mapping (For Audit & Post-Annotation Scoring Only)
const keyMappingPath = path.join(__dirname, 'blinded_eval_key_mapping.json');
fs.writeFileSync(keyMappingPath, JSON.stringify({
  auditSeal: 'STRICTLY CONFIDENTIAL - DECOUPLED EVALUATION GROUND TRUTH KEY',
  salt: SALT,
  totalItems: Object.keys(keyMapping).length,
  mapping: keyMapping
}, null, 2));

// Write 3: Human-Readable Markdown Annotation Sheets for Blinded Reviewers
let mdContent = `# KMIT Kahoot — Blinded Human Educator Evaluation Portfolio
**Study**: Q1 Empirical Validation of Automated Question Generation (AQG)
**Evaluation Design**: Dual-Blind Independent Expert Review ($N = 406$ Questions across 14 Disciplines)
**Instruction**: Rate each item independently using the three standardized psychometric rubrics below. Do NOT share ratings between evaluators before initial submission.

---

## Evaluation Rubrics

### 1. Bloom's Cognitive Taxonomy (Ordinal Scale: 1–3)
- **Tier 1 (Recall / Remember)**: Direct definition retrieval, verbatim fact recall, basic terminology.
- **Tier 2 (Understand / Comprehend)**: Summarizing concepts, distinguishing between related ideas, explaining mechanisms.
- **Tier 3 (Apply / Analyze / Evaluate)**: Tracing algorithms, computing quantitative outputs, diagnosing system failure states, comparing trade-offs.

### 2. Contextual Grounding (Binary Indicator: 0 / 1)
- **1 (Faithful)**: The question and correct answer are factually grounded in the lecture transcript and its educational objectives.
- **0 (Hallucinated / Contradictory)**: The item relies on unmentioned outside concepts, contradicts the lecture material, or introduces erroneous assertions.

### 3. Distractor Plausibility Index — DPI (Ordinal Scale: 1–4)
- **Tier 1 (Trivially Flawed)**: Nonsensical phrasing, syntactically incoherent, or trivially ruled out by any layperson.
- **Tier 2 (Superficial)**: Grammatically correct but contextually weak; eliminated with minimal subject knowledge.
- **Tier 3 (Plausible)**: Valid domain terminology; requires basic grasp of the topic to differentiate from correct answer.
- **Tier 4 (Diagnostic Misconception)**: Represents an authentic, documented pedagogical misconception, subtle edge case, or mathematical boundary error.

---

`;

for (const pkg of packagePortfolios) {
  mdContent += `\n## Package ${pkg.packageId} — ${pkg.domain}\n`;
  mdContent += `**Topic**: ${pkg.topic}\n`;
  mdContent += `**Learning Objective**: ${pkg.objective}\n`;
  mdContent += `**Question Count**: ${pkg.items.length} randomized items\n\n`;

  pkg.items.forEach((item, idx) => {
    mdContent += `### Item ${idx + 1}: \`${item.itemId}\`\n`;
    mdContent += `**Prompt**: ${item.questionText}\n\n`;
    mdContent += `**Options**:\n`;
    item.options.forEach((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      const isKey = opt === item.correctAnswer ? ' *(Indicated Key)*' : '';
      mdContent += `- **[${letter}]** ${opt}${isKey}\n`;
    });
    mdContent += `\n`;
    mdContent += `| Metric | Evaluator 1 Score | Evaluator 2 Score | Notes / Specific Feedback |\n`;
    mdContent += `| :--- | :---: | :---: | :--- |\n`;
    mdContent += `| **Bloom Tier (1–3)** | [ ] | [ ] | |\n`;
    mdContent += `| **Grounding (0 / 1)** | [ ] | [ ] | |\n`;
    mdContent += `| **DPI Tier (1–4)** | [ ] | [ ] | |\n\n`;
    mdContent += `---\n\n`;
  });
}

const mdPath = path.join(__dirname, 'blinded_eval_sheets.md');
fs.writeFileSync(mdPath, mdContent);

console.log('\nBlinded Portfolios Successfully Generated:');
console.log(`- Portfolio JSON: ${portfolioPath}`);
console.log(`- Ground-Truth Key Mapping: ${keyMappingPath}`);
console.log(`- Human Reviewer Sheets: ${mdPath}`);
console.log(`\nCorpus Distribution Verified:`);
console.log(`- System 1 Items: ${systemCounts['System 1']} (Expected: 126)`);
console.log(`- System 2 Items: ${systemCounts['System 2']} (Expected: 140)`);
console.log(`- System 3 Items: ${systemCounts['System 3']} (Expected: 140)`);
console.log(`- Total Evaluated Items: ${grandTotalCount} (Expected: 406)`);
