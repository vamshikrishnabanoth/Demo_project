/**
 * server/engine/quizPlanner/documentClassifier.js
 * 
 * DOCUMENT TYPE & INSTRUCTIONAL INTENT CLASSIFIER
 * Infers document profile and allocates adaptive question style composition (60-80% practical executable syntax).
 */

'use strict';

function classifyDocumentAndIntent(conceptGraph = {}, textContent = "") {
  const nodes = Array.isArray(conceptGraph.nodes) ? conceptGraph.nodes : [];
  const text = String(textContent || "").toLowerCase();

  // Count executable nodes & syntax indicators
  const executableCount = nodes.filter(n => n.executable || n.canGenerateSyntaxQuestion).length;
  const executableRatio = nodes.length > 0 ? executableCount / nodes.length : 0;

  const dbMatches = (text.match(/\b(mongodb|sql|query|crud|update|delete|find|aggregate|\$push|\$set|\$gt|\$in)\b/g) || []).length;
  const codeMatches = (text.match(/\b(function|class|const|let|var|return|async|await|import|def)\b/g) || []).length;
  const assignmentMatches = (text.match(/\b(assignment|exercise|task|scenario|restock|products|stock|price|movies)\b/g) || []).length;

  let docType = "THEORY_TEXTBOOK";
  let primaryIntent = "Learn concepts";

  if (dbMatches >= 3 || text.includes('crud') || text.includes('query')) {
    docType = "DATABASE_QUERY_DOCUMENT";
    primaryIntent = "Write queries & Apply operators";
  } else if (codeMatches >= 3 || text.includes('programming')) {
    docType = "PROGRAMMING_ASSIGNMENT";
    primaryIntent = "Debug code & Analyze execution";
  } else if (assignmentMatches >= 2 || text.includes('lab')) {
    docType = "PRACTICAL_LAB";
    primaryIntent = "Apply practical operators";
  }

  // Calculate Adaptive Allocation Ratios
  const isPractical = docType === "DATABASE_QUERY_DOCUMENT" || docType === "PROGRAMMING_ASSIGNMENT" || docType === "PRACTICAL_LAB" || executableRatio > 0.25;

  const targetPracticalRatio = isPractical ? 0.70 : 0.20; // 70% practical for lab/assignments
  const targetDefinitionRatio = 1.0 - targetPracticalRatio;

  return {
    docType,
    primaryIntent,
    isPractical,
    composition: {
      practicalExecutableRatio: targetPracticalRatio,
      conceptualDefinitionRatio: targetDefinitionRatio
    }
  };
}

module.exports = {
  classifyDocumentAndIntent
};
