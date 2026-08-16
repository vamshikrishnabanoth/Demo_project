/**
 * server/engine/evidence/depthAnalyzer.js
 *
 * Unified Pedagogical Lecture Depth & Academic Content Analyzer (v1.2).
 * - Distinguishes Academic Instruction from Casual / Irrelevant Chatter.
 * - Evaluates Lecture Depth (Introductory, Developing, Comprehensive) without artificial capacity ceilings.
 * - Maps detected focus concepts and teaching characteristics.
 */

'use strict';

class DepthAnalyzer {
  /**
   * Analyze raw text or transcript for Academic Content and Pedagogical Depth.
   * @param {String} text - Raw transcript or combined document text
   * @returns {Object} { isAcademic, reason, lectureDepth, detectedFocus }
   */
  analyzeLecture(text = '') {
    const raw = (text || '').trim();
    if (raw.length < 15) {
      return {
        isAcademic: false,
        reason: 'INSUFFICIENT_CONTENT',
        lectureDepth: {
          rating: 'Non-Academic',
          score: 0,
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' }
        },
        detectedFocus: []
      };
    }

    const lower = raw.toLowerCase();
    const words = raw.split(/\s+/);
    const wordCount = words.length;

    // 1. Academic Content Detection
    const academicIndicators = [
      'concept', 'definition', 'means', 'function', 'system', 'process', 'method', 'algorithm',
      'structure', 'theory', 'principle', 'approach', 'model', 'data', 'database', 'query',
      'network', 'memory', 'processor', 'cpu', 'instruction', 'interrupt', 'pipeline', 'stack',
      'register', 'array', 'variable', 'object', 'class', 'interface', 'protocol', 'layer',
      'hardware', 'software', 'operation', 'execution', 'result', 'because', 'therefore',
      'difference', 'compare', 'example', 'instance', 'step', 'phase', 'stage', 'table',
      'token', 'tokenizer', 'vector', 'neural', 'weights', 'loss', 'training', 'feature'
    ];

    const casualIndicators = [
      'went to', 'having lunch', 'had lunch', 'dinner', 'yesterday', 'tomorrow', 'weather', 'movie',
      'traffic', 'party', 'weekend', 'shopping', 'funny', 'haha', 'lol', 'bored', 'chitchat', 'cafeteria'
    ];

    let academicMatches = 0;
    academicIndicators.forEach(term => {
      if (lower.includes(term)) academicMatches++;
    });

    let casualMatches = 0;
    casualIndicators.forEach(term => {
      if (lower.includes(term)) casualMatches++;
    });

    const isAcademic = (academicMatches >= 2 && academicMatches > casualMatches) || (wordCount >= 15 && casualMatches === 0 && academicMatches >= 1);
    if (!isAcademic) {
      return {
        isAcademic: false,
        reason: 'INSUFFICIENT_ACADEMIC_CONTENT',
        lectureDepth: {
          rating: 'Non-Academic',
          score: 10,
          characteristics: { conceptExplanation: 'None', reasoning: 'None', examples: 'None', procedures: 'None' }
        },
        detectedFocus: []
      };
    }

    // 2. Extract Detected Focus Terms
    const focusCandidates = raw.match(/\b[A-Z][a-zA-Z0-9_]{2,}\b/g) || [];
    const technicalKeywords = [
      'Interrupt', 'Polling', 'ISR', 'Stack', 'Register', 'Vector Table', 'Pipeline',
      'Aggregation', 'Indexing', 'NoSQL', 'Document', 'Tokenization', 'Vocabulary', 'Schema',
      'Recursion', 'Binary Tree', 'Dijkstra', 'Sorting', 'Graph', 'Memory', 'CPU', 'Thread',
      'Tokenizer', 'Neural Network', 'Vector'
    ];

    const foundTechnical = technicalKeywords.filter(k => lower.includes(k.toLowerCase()));
    const rawFocusSet = new Set([...foundTechnical, ...focusCandidates.slice(0, 8)]);
    const detectedFocus = Array.from(rawFocusSet).slice(0, 6);
    if (detectedFocus.length === 0) detectedFocus.push('Core Concepts');

    // 3. Characteristic Signals
    // A. Concept Explanation
    const defMarkers = ['is a', 'is an', 'defined as', 'refers to', 'converts', 'represents', 'means'];
    const hasDef = defMarkers.some(m => lower.includes(m));
    const conceptExp = hasDef || detectedFocus.length >= 2 ? (wordCount > 60 ? 'Strong' : 'Moderate') : 'Developing';

    // B. Reasoning & Why
    const reasonMarkers = ['because', 'therefore', 'why', 'in order to', 'leads to', 'results in', 'enables', 'allows', 'tradeoff'];
    const reasonCount = reasonMarkers.filter(m => lower.includes(m)).length;
    const reasoning = reasonCount >= 3 ? 'Strong' : (reasonCount >= 1 ? 'Moderate' : 'Light');

    // C. Examples & Demonstrations
    const exampleMarkers = ['for example', 'for instance', 'consider', 'suppose', 'like when', 'scenario', 'such as'];
    const hasExamples = exampleMarkers.some(m => lower.includes(m));
    const examples = hasExamples ? 'Present' : 'Light';

    // D. Procedural Detail
    const procMarkers = ['first', 'second', 'then', 'after', 'before', 'finally', 'step', 'resumes', 'finishes', 'saves', 'loads'];
    const procCount = procMarkers.filter(m => lower.includes(m)).length;
    const procedures = procCount >= 3 ? 'Strong' : (procCount >= 1 ? 'Moderate' : 'Light');

    // 4. Overall Depth Rating
    let depthScore = 40; // baseline for valid academic statement
    if (conceptExp === 'Strong') depthScore += 15;
    if (reasoning === 'Strong') depthScore += 15;
    else if (reasoning === 'Moderate') depthScore += 8;
    if (examples === 'Present') depthScore += 12;
    if (procedures === 'Strong') depthScore += 15;
    else if (procedures === 'Moderate') depthScore += 8;
    if (lower.includes('```') || lower.includes('=')) depthScore += 8;

    depthScore = Math.min(100, Math.max(30, depthScore));

    let rating = 'Developing';
    if (depthScore < 50) rating = 'Introductory';
    else if (depthScore >= 75) rating = 'Comprehensive';

    return {
      isAcademic: true,
      reason: null,
      lectureDepth: {
        rating,
        score: depthScore,
        characteristics: {
          conceptExplanation: conceptExp,
          reasoning,
          examples,
          procedures
        }
      },
      detectedFocus
    };
  }
}

module.exports = new DepthAnalyzer();
