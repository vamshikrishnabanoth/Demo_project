/**
 * server/engine/conceptGraphBuilder/extractors/objectiveExtractor.js
 * 
 * LEARNING OBJECTIVE EXTRACTOR
 * Infers actionable instructional learning objectives per extracted concept.
 */

'use strict';

function inferLearningObjective(conceptLabel, category, textSnippet = "") {
  const label = String(conceptLabel || "").trim();
  const lower = label.toLowerCase();
  const cat = String(category || "").toUpperCase();

  if (cat === "UPDATE_OPERATOR" || lower.startsWith("$push") || lower.startsWith("$set") || lower.startsWith("$inc") || lower.startsWith("$pull")) {
    return `Student should understand how ${label} modifies or updates document fields and array elements in database operations.`;
  }
  
  if (cat === "QUERY_OPERATOR" || lower.startsWith("$gt") || lower.startsWith("$gte") || lower.startsWith("$in") || lower.startsWith("$elemMatch")) {
    return `Student should know how ${label} filters and queries database documents matching criteria.`;
  }

  if (cat === "DATABASE_COMMAND" || lower.includes("find") || lower.includes("update") || lower.includes("delete") || lower.includes("aggregate")) {
    return `Student should master executing ${label} queries with proper syntax and execution behavior.`;
  }

  if (cat === "API_ENDPOINT") {
    return `Student should understand API route handling and request payload structure for ${label}.`;
  }

  if (cat === "DATA_STRUCTURE" || lower.includes("tree") || lower.includes("index") || lower.includes("array") || lower.includes("list")) {
    return `Student should understand the structure, memory layout, and operational efficiency of ${label}.`;
  }

  return `Student should understand the core concepts, syntax, and operational usage of ${label}.`;
}

module.exports = {
  inferLearningObjective
};
