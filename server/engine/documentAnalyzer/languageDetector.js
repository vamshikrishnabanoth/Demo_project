/**
 * Stage 1.5: Language / Syntax Family Detector
 * Identifies whether a document belongs to MongoDB, SQL, Python, Java, JavaScript, Shell, Kubernetes/YAML, or Theoretical CS.
 */

const LANGUAGE_SIGNATURES = {
  MongoDB: {
    patterns: [
      /\$(group|unwind|match|project|addFields|lookup|switch|facet|sort|limit|skip|push|addToSet|gt|lt|gte|lte|in|nin|exists|type|expr|sum|avg|max|min)\b/gi,
      /\b(db\.[a-zA-Z0-9_]+\.(aggregate|find|updateMany|updateOne|insertMany|insertOne|deleteMany|deleteOne|explain|createIndex))\b/gi,
      /\b(IXSCAN|COLLSCAN|FETCH|SORT|OR|AND|STAGE)\b/gi
    ],
    weight: 2.5
  },
  SQL: {
    patterns: [
      /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|JOIN|LEFT JOIN|RIGHT JOIN|GROUP BY|ORDER BY|HAVING|WHERE|CREATE TABLE|ALTER TABLE|PRIMARY KEY|FOREIGN KEY)\b/gi
    ],
    weight: 2.0
  },
  Python: {
    patterns: [
      /\b(def |class |import |from [a-zA-Z0-9_]+ import|lambda |self\.|__init__|print\(|return |try:|except |with open)\b/gi
    ],
    weight: 2.0
  },
  Java: {
    patterns: [
      /\b(public class|private final|protected |System\.out\.println|ArrayList<|HashMap<|new [A-Z][a-zA-Z0-9_]*\(|throws Exception)\b/gi
    ],
    weight: 2.0
  },
  JavaScript: {
    patterns: [
      /\b(const |let |var |function |async |await |export default|import .* from|console\.log|Promise\.|=>)\b/gi
    ],
    weight: 1.8
  },
  Shell: {
    patterns: [
      /\b(sudo |chmod |chown |grep |awk |sed |docker |kubectl |systemctl |export [A-Z_]+=)\b/gi
    ],
    weight: 2.0
  },
  Kubernetes: {
    patterns: [
      /\b(apiVersion:|kind: Pod|kind: Deployment|kind: Service|spec:|containers:|selector:|metadata:)\b/gi
    ],
    weight: 2.5
  }
};

function detectLanguageFamily(text) {
  if (!text || typeof text !== 'string') {
    return { primaryLanguageFamily: 'Theoretical CS', confidence: 0.5 };
  }

  const scores = {};
  let maxScore = 0;
  let bestLang = 'Theoretical CS';

  Object.entries(LANGUAGE_SIGNATURES).forEach(([lang, config]) => {
    let matchCount = 0;
    config.patterns.forEach(pat => {
      const matches = text.match(pat);
      if (matches) {
        matchCount += matches.length;
      }
    });
    const totalScore = matchCount * config.weight;
    scores[lang] = totalScore;
    if (totalScore > maxScore) {
      maxScore = totalScore;
      bestLang = lang;
    }
  });

  const confidence = maxScore > 0 ? Number(Math.min(1.0, 0.5 + (maxScore / 20.0)).toFixed(2)) : 0.5;

  return {
    primaryLanguageFamily: bestLang,
    confidence,
    scores
  };
}

module.exports = {
  detectLanguageFamily
};
