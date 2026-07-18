// server/services/classifierService.js

/**
 * Scans text to detect Code, Theory, Interview, and Scenario footprint keywords.
 * Maps coding ➔ code_debugging, interview ➔ fill_blank to match project schema.
 */
function calculateTokenDensity(text) {
    if (!text || typeof text !== 'string') {
        return { theory: 1.0, code_debugging: 0.0, fill_blank: 0.0, scenario: 0.0 };
    }
    const lowerText = text.toLowerCase();

    // 1. Coding Markers (Syntax elements, keywords, symbols)
    const codeRegex = /(function|public\s+static|def\s+|class\s+|const\s+|let\s+|void|int\s+|char\s+|import\s+|include|printf|cout|console\.log|[{}[\];=\-><])/g;
    const codeMatches = (lowerText.match(codeRegex) || []).length;

    // 2. Interview/Trade-off Markers (Comparison, evaluation phrases)
    const interviewRegex = /(versus|vs\b|compare|trade-off|differentiation|advantage|disadvantage|efficiency|complexity|time\s+complexity|space\s+complexity|optimize|why\s+do\s+we|preferred)/g;
    const interviewMatches = (lowerText.match(interviewRegex) || []).length;

    // 3. Scenario/System Design Markers (Production conditions)
    const scenarioRegex = /(imagine|suppose|consider\s+a\s+scenario|production\s+failure|deadlock|bottleneck|crash|downtime|scaling|real-world|application|user\s+request|traffic|latency|handling)/g;
    const scenarioMatches = (lowerText.match(scenarioRegex) || []).length;

    // 4. Theory Markers (Definitions, concepts)
    const theoryRegex = /(is\s+defined\s+as|concept\s+of|architecture|layer|protocol|fundamental|overview|characteristic|principle|history|component)/g;
    const theoryMatches = (lowerText.match(theoryRegex) || []).length;

    const totalMatches = codeMatches + interviewMatches + scenarioMatches + theoryMatches || 1;

    return {
        theory: theoryMatches / totalMatches,
        code_debugging: codeMatches / totalMatches,
        fill_blank: interviewMatches / totalMatches,
        scenario: scenarioMatches / totalMatches
    };
}

/**
 * Blends the teacher's preference weights with the factual text density
 * and normalizes them to equal exactly 1.0 (100%), honoring the Hard Zero rule.
 */
function computeDynamicBlend(teacherWeights, textDensity) {
    const alpha = 0.6; 
    
    // Normalize teacherWeights keys in case they use coding/interview from prompt description
    const tw = {
        theory: teacherWeights.theory ?? 0.25,
        code_debugging: teacherWeights.code_debugging ?? teacherWeights.coding ?? 0.25,
        fill_blank: teacherWeights.fill_blank ?? teacherWeights.interview ?? 0.25,
        scenario: teacherWeights.scenario ?? 0.25
    };

    let blended = {};
    let totalBlendedSum = 0;

    // Enforce Hard Zero rule: if teacherWeight is explicitly 0, final ratio is 0
    const categories = ['theory', 'code_debugging', 'fill_blank', 'scenario'];
    categories.forEach(cat => {
        if (tw[cat] === 0) {
            blended[cat] = 0;
        } else {
            blended[cat] = (alpha * tw[cat]) + ((1 - alpha) * (textDensity[cat] ?? 0.25));
            totalBlendedSum += blended[cat];
        }
    });

    // If all weights are 0, default back to equal distribution among non-zero ones
    if (totalBlendedSum === 0) {
        let activeCategories = categories.filter(cat => tw[cat] > 0);
        if (activeCategories.length === 0) {
            activeCategories = ['theory'];
        }
        categories.forEach(cat => {
            blended[cat] = activeCategories.includes(cat) ? 1.0 / activeCategories.length : 0;
        });
        totalBlendedSum = 1.0;
    }

    // Normalize final ratios
    let finalRatios = {};
    categories.forEach(cat => {
        finalRatios[cat] = parseFloat((blended[cat] / totalBlendedSum).toFixed(2));
    });

    // Make sure they sum exactly to 1.0 (correct rounding differences)
    let sum = finalRatios.theory + finalRatios.code_debugging + finalRatios.fill_blank + finalRatios.scenario;
    if (sum !== 1.0) {
        let diff = parseFloat((1.0 - sum).toFixed(2));
        let maxCat = categories.reduce((max, cat) => finalRatios[cat] > finalRatios[max] ? cat : max, 'theory');
        finalRatios[maxCat] = parseFloat((finalRatios[maxCat] + diff).toFixed(2));
    }

    return finalRatios;
}

module.exports = { calculateTokenDensity, computeDynamicBlend };
