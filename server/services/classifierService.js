// server/services/classifierService.js

/**
 * Scans text to detect the 5 Master Academic Archetype footprint keywords.
 */
function calculateTokenDensity(text) {
    if (!text || typeof text !== 'string') {
        return {
            CONCEPTS_AND_DEFINITIONS: 0.2,
            COMPARISONS_AND_TRADEOFFS: 0.2,
            FORMULAS_AND_CALCULATIONS: 0.2,
            CASE_STUDIES_AND_SCENARIOS: 0.2,
            PRACTICAL_AND_LAB_TASKS: 0.2
        };
    }
    const lowerText = text.toLowerCase();

    // 1. Concepts & Definitions Markers
    const conceptsRegex = /(is\s+defined\s+as|concept\s+of|architecture|layer|protocol|fundamental|overview|characteristic|principle|history|component)/g;
    const conceptsMatches = (lowerText.match(conceptsRegex) || []).length;

    // 2. Comparisons & Tradeoffs Markers
    const comparisonsRegex = /(versus|vs\b|compare|trade-off|differentiation|advantage|disadvantage|efficiency|complexity|optimize|why\s+do\s+we|preferred)/g;
    const comparisonsMatches = (lowerText.match(comparisonsRegex) || []).length;

    // 3. Formulas & Calculations Markers
    const formulasRegex = /(formulas|calculations|math|equation|arithmetic|complexity|time\s+complexity|space\s+complexity|derive|proof|numerical)/g;
    const formulasMatches = (lowerText.match(formulasRegex) || []).length;

    // 4. Case Studies & Scenarios Markers
    const scenariosRegex = /(imagine|suppose|consider\s+a\s+scenario|production\s+failure|deadlock|bottleneck|crash|downtime|scaling|real-world|application|user\s+request|traffic|latency|handling)/g;
    const scenariosMatches = (lowerText.match(scenariosRegex) || []).length;

    // 5. Practical & Lab Tasks Markers
    const practicalRegex = /(function|public\s+static|def\s+|class\s+|const\s+|let\s+|void|int\s+|char\s+|import\s+|include|printf|cout|console\.log|[{}[\];=\-><])/g;
    const practicalMatches = (lowerText.match(practicalRegex) || []).length;

    const totalMatches = conceptsMatches + comparisonsMatches + formulasMatches + scenariosMatches + practicalMatches || 1;

    return {
        CONCEPTS_AND_DEFINITIONS: conceptsMatches / totalMatches,
        COMPARISONS_AND_TRADEOFFS: comparisonsMatches / totalMatches,
        FORMULAS_AND_CALCULATIONS: formulasMatches / totalMatches,
        CASE_STUDIES_AND_SCENARIOS: scenariosMatches / totalMatches,
        PRACTICAL_AND_LAB_TASKS: practicalMatches / totalMatches
    };
}

/**
 * Blends the teacher's preference weights with the factual text density
 * and normalizes them to equal exactly 1.0 (100%), honoring the Hard Zero rule.
 */
function computeDynamicBlend(teacherWeights, textDensity) {
    const alpha = 0.6; 
    
    const tw = {
        CONCEPTS_AND_DEFINITIONS: teacherWeights.CONCEPTS_AND_DEFINITIONS ?? teacherWeights.CORE_THEORY ?? 0.2,
        COMPARISONS_AND_TRADEOFFS: teacherWeights.COMPARISONS_AND_TRADEOFFS ?? teacherWeights.ANALYTICAL_REASONING ?? 0.2,
        FORMULAS_AND_CALCULATIONS: teacherWeights.FORMULAS_AND_CALCULATIONS ?? teacherWeights.NUMERICAL_DESIGN ?? 0.2,
        CASE_STUDIES_AND_SCENARIOS: teacherWeights.CASE_STUDIES_AND_SCENARIOS ?? teacherWeights.REAL_WORLD_APPLICATION ?? 0.2,
        PRACTICAL_AND_LAB_TASKS: teacherWeights.PRACTICAL_AND_LAB_TASKS ?? teacherWeights.IMPLEMENTATION_SYNTHESIS ?? 0.2
    };

    let blended = {};
    let totalBlendedSum = 0;

    const categories = [
        'CONCEPTS_AND_DEFINITIONS',
        'COMPARISONS_AND_TRADEOFFS',
        'FORMULAS_AND_CALCULATIONS',
        'CASE_STUDIES_AND_SCENARIOS',
        'PRACTICAL_AND_LAB_TASKS'
    ];

    categories.forEach(cat => {
        if (tw[cat] === 0) {
            blended[cat] = 0;
        } else {
            blended[cat] = (alpha * tw[cat]) + ((1 - alpha) * (textDensity[cat] ?? 0.2));
            totalBlendedSum += blended[cat];
        }
    });

    if (totalBlendedSum === 0) {
        let activeCategories = categories.filter(cat => tw[cat] > 0);
        if (activeCategories.length === 0) {
            activeCategories = ['CONCEPTS_AND_DEFINITIONS'];
        }
        categories.forEach(cat => {
            blended[cat] = activeCategories.includes(cat) ? 1.0 / activeCategories.length : 0;
        });
        totalBlendedSum = 1.0;
    }

    let finalRatios = {};
    categories.forEach(cat => {
        finalRatios[cat] = parseFloat((blended[cat] / totalBlendedSum).toFixed(2));
    });

    // Make sure they sum exactly to 1.0
    let sum = categories.reduce((s, cat) => s + finalRatios[cat], 0);
    if (Math.abs(sum - 1.0) > 0.0001) {
        let diff = parseFloat((1.0 - sum).toFixed(2));
        let maxCat = categories.reduce((max, cat) => finalRatios[cat] > finalRatios[max] ? cat : max, 'CONCEPTS_AND_DEFINITIONS');
        finalRatios[maxCat] = parseFloat((finalRatios[maxCat] + diff).toFixed(2));
    }

    return finalRatios;
}

module.exports = { calculateTokenDensity, computeDynamicBlend };
