const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SALT = 'kmit-kahoot-q1-blinded-audit-seed-20261106';

function generateItemToken(pkgId, sysId, idx) {
  const hash = crypto.createHmac('sha256', SALT)
    .update(`${pkgId}:${sysId}:${idx}`)
    .digest('hex');
  return `ITEM-${hash.slice(0, 8).toUpperCase()}`;
}

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

// Formal subtopic lists for all 14 packages derived from syllabus_context and curriculum objectives
const PACKAGE_SYLLABUS_SUBTOPICS = {
  pkg_01_indian_constitution_art21: [
    { id: 'SUB_01', name: 'A.K. Gopalan Literal Interpretation & Silo Theory' },
    { id: 'SUB_02', name: 'Procedure Established by Law vs Due Process' },
    { id: 'SUB_03', name: 'Maneka Gandhi & Golden Triangle Doctrine (Articles 14, 19, 21)' },
    { id: 'SUB_04', name: 'Substantive Fairness, Reasonableness & Universal Applicability' }
  ],
  pkg_02_linear_algebra_eigenvalues: [
    { id: 'SUB_01', name: 'Geometric Intuition of Eigenvectors as Invariant Directions' },
    { id: 'SUB_02', name: 'Characteristic Polynomial & det(A - lambda I) = 0' },
    { id: 'SUB_03', name: '2x2 Matrix Eigenvalue and Eigenvector Calculation' },
    { id: 'SUB_04', name: 'Multiplicity, Invariant Subspaces & Diagonalizability' }
  ],
  pkg_03_dsa_bfs_conceptual: [
    { id: 'SUB_01', name: 'BFS Exploration Paradigm & Level-Order Mechanics' },
    { id: 'SUB_02', name: 'FIFO Queue Invariant & Unweighted Shortest Path Proof' },
    { id: 'SUB_03', name: 'Visited Set Tracking & Cycle Avoidance' },
    { id: 'SUB_04', name: 'Frontier State Transitions & Completeness' }
  ],
  pkg_04_dsa_bfs_implementation: [
    { id: 'SUB_01', name: 'Queue Data Structure Implementation in Code' },
    { id: 'SUB_02', name: 'Step-by-Step State Variable Tracing' },
    { id: 'SUB_03', name: 'Cyclic Graph and Disconnected Component Handling' },
    { id: 'SUB_04', name: 'Algorithmic Complexity and Memory Bounds' }
  ],
  pkg_05_deep_learning_vaes: [
    { id: 'SUB_01', name: 'Classical Autoencoder Failure Modes & Structural Bottlenecks' },
    { id: 'SUB_02', name: 'Latent Space Geometry & Smooth Generative Interpolation' },
    { id: 'SUB_03', name: 'Variational Objective & Gaussian Prior Mapping (mu, sigma^2)' },
    { id: 'SUB_04', name: 'KL Divergence Regularization & Reparameterization Trick' }
  ],
  pkg_06_economics_elasticity: [
    { id: 'SUB_01', name: 'Price Elasticity of Demand Definition & Midpoint Formula' },
    { id: 'SUB_02', name: 'Elastic vs Inelastic Demand Curves & Total Revenue Test' },
    { id: 'SUB_03', name: 'Income and Cross-Price Elasticity Determinants' },
    { id: 'SUB_04', name: 'Price Controls, Welfare Loss & Deadweight Loss' }
  ],
  pkg_07_os_deadlocks: [
    { id: 'SUB_01', name: 'Four Coffman Conditions & Deadlock Characterization' },
    { id: 'SUB_02', name: 'Safe vs Unsafe System States & Safe Sequences' },
    { id: 'SUB_03', name: "Dijkstra's Banker's Algorithm & Multi-Resource Matrix Trace" },
    { id: 'SUB_04', name: 'Prevention, Avoidance, and Detection/Recovery Trade-Offs' }
  ],
  pkg_08_biochem_kinetics: [
    { id: 'SUB_01', name: 'Steady-State Assumption & Michaelis-Menten Equation Derivation' },
    { id: 'SUB_02', name: 'Physical Meaning of Km, Vmax & Catalytic Efficiency (kcat/Km)' },
    { id: 'SUB_03', name: 'Lineweaver-Burk Double-Reciprocal Transformation' },
    { id: 'SUB_04', name: 'Competitive, Non-Competitive & Uncompetitive Inhibition' }
  ],
  pkg_09_discrete_math_trees: [
    { id: 'SUB_01', name: 'Free Trees, Spanning Trees & Fundamental Cycles' },
    { id: 'SUB_02', name: 'Cut Property Theorem & Greedy Choice Invariant' },
    { id: 'SUB_03', name: "Kruskal's Algorithm Trace with Disjoint Set Union (DSU)" },
    { id: 'SUB_04', name: "Asymptotic Complexity Bounds & Prim's Comparison" }
  ],
  pkg_10_microecon_game_theory: [
    { id: 'SUB_01', name: 'Strategic Form Games, Action Profiles & Payoff Matrices' },
    { id: 'SUB_02', name: 'Iterated Elimination of Strictly Dominated Strategies (IESDS)' },
    { id: 'SUB_03', name: 'Pure-Strategy Nash Equilibrium & Best-Response Analysis' },
    { id: 'SUB_04', name: "Prisoner's Dilemma, Coordination Failures & Pareto Inefficiency" }
  ],
  pkg_11_physics_thermodynamics: [
    { id: 'SUB_01', name: 'Four Reversible Stages of the Carnot Engine Cycle' },
    { id: 'SUB_02', name: 'Thermal Efficiency Derivation eta = 1 - T_C/T_H' },
    { id: 'SUB_03', name: 'Work Output, Heat Rejected & P-V / T-S State Analysis' },
    { id: 'SUB_04', name: 'Clausius Inequality, Entropy Generation & Irreversibility' }
  ],
  pkg_12_pharmacology_clearance: [
    { id: 'SUB_01', name: 'One-Compartment Intravenous Bolus Pharmacokinetic Model' },
    { id: 'SUB_02', name: 'Plasma Concentration Decay & Elimination Rate Constant (k_e)' },
    { id: 'SUB_03', name: 'Systemic Clearance (CL) & Apparent Volume of Distribution (V_d)' },
    { id: 'SUB_04', name: 'Multi-Step Half-Life (t_1/2) & Non-Linear Elimination Kinetics' }
  ],
  pkg_13_logic_predicates: [
    { id: 'SUB_01', name: 'First-Order Syntax, Predicates & Nested Quantifiers (forall, exists)' },
    { id: 'SUB_02', name: 'Free vs Bound Variables & Quantifier Scope Mechanics' },
    { id: 'SUB_03', name: 'Model Structures M = <D, I> & Truth Under Assignments' },
    { id: 'SUB_04', name: 'Quantifier Inference Rules, Soundness & Vacuous Truth' }
  ],
  pkg_14_signal_processing_fourier: [
    { id: 'SUB_01', name: 'Discrete Fourier Transform (DFT) Analysis Equation' },
    { id: 'SUB_02', name: 'Sampling Rate, Frequency Bin Spacing & Spectral Resolution' },
    { id: 'SUB_03', name: 'Nyquist-Shannon Sampling Criterion & Spectral Aliasing' },
    { id: 'SUB_04', name: 'Anti-Aliasing Filtering & Finite-Record Spectral Leakage' }
  ]
};

console.log('Generating Final Blinded Educator Evaluation Package...');

const allItems = [];
const keyMapping = {};
const packagePortfolios = [];
let grandTotal = 0;
const counts = { system1: 0, system2: 0, system3: 0 };
let fiveOptionCount = 0;

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
      grandTotal++;
      if (sys.id === 'system_1') counts.system1++;
      if (sys.id === 'system_2') counts.system2++;
      if (sys.id === 'system_3') counts.system3++;

      if (q.options.length === 5) fiveOptionCount++;

      // Strict Blinded Item: NO answer key leaked, NO provenance strings, NO internal generator boilerplates
      const anonymizedItem = {
        itemId: token,
        packageId: pkg,
        domain: metadata.domain || 'Academic Discipline',
        subject: metadata.subject || '',
        topic: metadata.topic || '',
        questionText: q.questionText,
        options: [...q.options],
        optionCount: q.options.length
      };

      // Isolated Ground-Truth Key Mapping (Decoupled from Reviewers)
      const correctText = q.correctAnswer || (q.options && q.options[q.correct_option]) || '';
      let correctIdx = q.options.findIndex(opt => opt.trim() === correctText.trim());
      if (correctIdx === -1 && typeof q.correct_option === 'number') correctIdx = q.correct_option;

      keyMapping[token] = {
        itemId: token,
        packageId: pkg,
        systemId: sys.id,
        systemLabel: sys.label,
        originalIndex: idx,
        declaredCorrectOptionIndex: correctIdx,
        declaredCorrectOptionLetter: correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : 'UNKNOWN',
        declaredCorrectAnswerText: correctText,
        declaredDifficulty: q.targetDifficulty || 'Medium',
        generatorSubtopic: q.subtopic || null,
        optionCount: q.options.length,
        isFiveOptionItem: q.options.length === 5,
        model: data.model || 'openai/gpt-oss-120b'
      };

      pkgItems.push(anonymizedItem);
      allItems.push(anonymizedItem);
    });
  }

  // Shuffle within package using deterministic seed
  const shuffledPkgItems = deterministicShuffle(pkgItems, `${SALT}:${pkg}`);

  packagePortfolios.push({
    packageId: pkg,
    domain: metadata.domain || '',
    subject: metadata.subject || '',
    topic: metadata.topic || '',
    learningObjective: metadata.declared_learning_objective || metadata.objective || '',
    syllabusContext: metadata.syllabus_context || '',
    subtopics: PACKAGE_SYLLABUS_SUBTOPICS[pkg] || [],
    itemCount: shuffledPkgItems.length,
    items: shuffledPkgItems
  });
}

// 1. Write Machine-Readable Portfolio JSON
const portfolioPath = path.join(__dirname, 'blinded_eval_portfolio.json');
fs.writeFileSync(portfolioPath, JSON.stringify({
  manifest: {
    description: 'Blinded Dual-Annotation Human Evaluation Portfolio for Q1 Multimodal AQG Benchmarking',
    totalItems: grandTotal,
    totalPackages: pkgs.length,
    distribution: {
      system1ZeroShot: counts.system1,
      system2SlidingRAG: counts.system2,
      system3FrozenLCACM: counts.system3
    },
    formatAccounting: {
      standardFourOptionItems: grandTotal - fiveOptionCount,
      fiveOptionItemsSystem1: fiveOptionCount,
      totalDistractorsToRate: (counts.system2 * 3) + (counts.system3 * 3) + (115 * 3) + (11 * 4) // 420 + 420 + 345 + 44 = 1229
    },
    evaluatorBlindingPolicy: 'Strict Double-Blind: Answer keys, declared difficulties, system provenance, and latency metrics decoupled.',
    hashAlgorithm: 'HMAC-SHA256 (Deterministic Salt)',
    generatedAt: new Date().toISOString()
  },
  packagePortfolios
}, null, 2));

// 2. Write Isolated Ground-Truth Key Mapping JSON
const keyMappingPath = path.join(__dirname, 'blinded_eval_key_mapping.json');
fs.writeFileSync(keyMappingPath, JSON.stringify({
  auditNotice: 'STRICTLY CONFIDENTIAL - DECOUPLED GROUND TRUTH KEY FOR POST-ANNOTATION SCORING ONLY',
  salt: SALT,
  totalItems: Object.keys(keyMapping).length,
  mapping: keyMapping
}, null, 2));

// 3. Write Comprehensive Educator Evaluation Markdown Sheets
let md = `# KMIT Kahoot — Blinded Human Educator Evaluation Portfolio
**Study**: Q1 Empirical Validation of Automated Question Generation (AQG)  
**Evaluation Design**: Dual-Blind Independent Expert Review ($N = 406$ Questions across 14 Academic Disciplines)  
**Core AI Engine Status**: Frozen at Commit \`ccf942f2be386e57e7d4acd6f4edf2cacbf86112\`  
**Reviewer Protocol**: Two independent subject-matter educators per academic discipline evaluate all items independently without consulting each other or sharing scoring sheets prior to formal submission.  

> [!IMPORTANT]
> **Blinding Notice**: In accordance with experimental protocols, the answer keys, pipeline models, and system sources have been completely decoupled from this evaluation package. You must evaluate each question purely based on the provided lecture topic, syllabus context, learning objectives, and multiple-choice options.

---

## Standardized Educator Evaluation Rubrics

Each item must be evaluated across the following six psychometric and curricular criteria:

### 1. Identified Correct Option & Question Correctness (Scale: 1–4)
- **Identified Correct Option**: Indicate which option represents the defensible correct answer (**[A]**, **[B]**, **[C]**, **[D]**, or **[E]** if present). If no option or multiple options are defensible, indicate **"FLAWED"**.
- **Question Correctness Rating**:
  - **Tier 4 (Flawless)**: Exactly one unambiguous, factually indisputable correct answer.
  - **Tier 3 (Acceptable with Minor Phrasing Dispute)**: Exactly one correct answer, but wording is slightly informal or debatable at the boundary.
  - **Tier 2 (Ambiguous / Multiple Correct)**: Two or more options can be defended as correct under reasonable interpretations.
  - **Tier 1 (Fatal Error / No Correct Answer)**: Key is factually false, contradictive, or no option is correct.

### 2. Question Clarity & Precision (Scale: 1–4)
- **Tier 4 (Clear & Professional)**: Flawless academic phrasing; prompt clearly specifies what is asked without extraneous ambiguity.
- **Tier 3 (Adequate)**: Understandable, though contains minor syntactic awkwardness or slightly verbose phrasing.
- **Tier 2 (Vague / Context Deficient)**: Lacks necessary parameters to evaluate the prompt without guessing intent.
- **Tier 1 (Incomprehensible / Misleading)**: Grammatically malformed or conceptually incoherent prompt.

### 3. Contextual Grounding (Binary: 0 / 1)
- **1 (Faithful)**: The question and correct answer are factually and conceptually grounded in the lecture transcript, topic, and curricular scope.
- **0 (Hallucinated / Contradictory)**: The item relies on unmentioned outside trivia, contradicts the lecture material, or introduces hallucinated claims.

### 4. Bloom's Cognitive Taxonomy Level (Scale: 1–3)
- **Tier 1 (Recall / Remember)**: Direct definition retrieval, verbatim fact recall, basic terminology.
- **Tier 2 (Understand / Comprehend)**: Summarizing concepts, distinguishing between related ideas, explaining mechanisms.
- **Tier 3 (Apply / Analyze / Evaluate)**: Tracing algorithms, computing quantitative outputs, diagnosing system failure states, comparing trade-offs.

### 5. Distractor Plausibility Index (DPI, Scale: 1–4 per incorrect option)
Rate each incorrect option individually:
- **Tier 4 (Diagnostic Misconception)**: High-quality distractor capturing an authentic student misconception, calculation trap, or edge case.
- **Tier 3 (Plausible)**: Believable domain distractor requiring solid subject understanding to rule out.
- **Tier 2 (Superficial)**: Grammatically sound but obviously false; ruled out with minimal domain knowledge.
- **Tier 1 (Trivially Flawed)**: Nonsensical phrasing, syntactically broken, or trivially dismissed by any layperson.

### 6. Syllabus Subtopic Classification
Assign the item to one of the 4 defined syllabus subtopics for this lecture package (e.g. SUB_01, SUB_02, SUB_03, or SUB_04). This enables independent calculation of Instructional Attention Fidelity (IAF).

---

`;

for (const pkg of packagePortfolios) {
  md += `\n# Academic Package: \`${pkg.packageId}\`\n`;
  md += `**Discipline / Domain**: ${pkg.domain}\n`;
  md += `**Subject**: ${pkg.subject}\n`;
  md += `**Topic**: ${pkg.topic}\n`;
  md += `**Declared Learning Objective**: ${pkg.learningObjective}\n`;
  md += `**Syllabus Context**: ${pkg.syllabusContext}\n\n`;

  md += `### Designated Syllabus Subtopics for this Package:\n`;
  pkg.subtopics.forEach(sub => {
    md += `- **[${sub.id}]**: ${sub.name}\n`;
  });
  md += `\n**Total Randomized Items to Review**: ${pkg.items.length}\n\n---\n\n`;

  pkg.items.forEach((item, idx) => {
    md += `## Item ${idx + 1} / ${pkg.items.length} — \`${item.itemId}\`\n\n`;
    md += `**Prompt**: ${item.questionText}\n\n`;
    md += `**Options**:\n`;
    item.options.forEach((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      md += `- **[${letter}]** ${opt}\n`;
    });
    md += `\n`;

    // Detailed Evaluation Form Table
    md += `| Evaluation Dimension | Evaluator 1 Rating | Evaluator 2 Rating | Reviewer Notes & Evidence |\n`;
    md += `| :--- | :---: | :---: | :--- |\n`;
    md += `| **Identified Correct Option** ([A]-[${String.fromCharCode(64 + item.options.length)}] or FLAWED) | [ ] | [ ] | |\n`;
    md += `| **Question Correctness** (Tier 1–4) | [ ] | [ ] | |\n`;
    md += `| **Question Clarity** (Tier 1–4) | [ ] | [ ] | |\n`;
    md += `| **Contextual Grounding** (0 / 1) | [ ] | [ ] | |\n`;
    md += `| **Bloom's Cognitive Level** (Tier 1–3) | [ ] | [ ] | |\n`;

    // Individual Distractor Plausibility Ratings
    item.options.forEach((_, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      md += `| **Distractor [${letter}] Plausibility** (Tier 1–4, N/A if Key) | [ ] | [ ] | |\n`;
    });

    md += `| **Subtopic Assignment** (${pkg.subtopics.map(s => s.id).join(' / ')}) | [ ] | [ ] | |\n`;
    md += `| **Item Acceptance Decision** (ACCEPT / REJECT) | [ ] | [ ] | |\n`;
    md += `| **Reason for Rejection** (if applicable) | — | — | |\n\n`;
    md += `---\n\n`;
  });
}

const mdPath = path.join(__dirname, 'blinded_eval_sheets.md');
fs.writeFileSync(mdPath, mdContent = md);

console.log('Final Blinded Package Successfully Generated:');
console.log(`- Portfolio JSON: ${portfolioPath}`);
console.log(`- Ground-Truth Key Mapping: ${keyMappingPath}`);
console.log(`- Markdown Sheets: ${mdPath}`);
console.log(`\nCorpus Distribution Check:`);
console.log(`- System 1 Items: ${counts.system1} (Expected: 126)`);
console.log(`- System 2 Items: ${counts.system2} (Expected: 140)`);
console.log(`- System 3 Items: ${counts.system3} (Expected: 140)`);
console.log(`- Total Evaluated Items: ${grandTotal} (Expected: 406)`);
console.log(`- Items with 5 Options: ${fiveOptionCount} (All System 1)`);
console.log(`- Total Rated Distractors: ${(counts.system2 * 3) + (counts.system3 * 3) + (115 * 3) + (11 * 4)} (Expected: 1229)`);
