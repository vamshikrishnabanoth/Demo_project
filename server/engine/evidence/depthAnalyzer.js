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
      'token', 'tokenizer', 'vector', 'neural', 'weights', 'loss', 'training', 'feature',
      'async', 'sync', 'callback', 'promise', 'event', 'listener', 'emitter', 'microtask',
      'closure', 'scope', 'handler', 'rest', 'http', 'api', 'endpoint', 'json', 'middleware',
      'tree', 'trees', 'binary', 'bst', 'node', 'nodes', 'root', 'leaf', 'height', 'depth',
      'traversal', 'inorder', 'preorder', 'postorder', 'graph', 'edge', 'vertex', 'vertices',
      'recursion', 'complexity', 'search', 'sort', 'heap', 'queue', 'linked', 'list', 'dsa'
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

    // 2. Concept-Grounded Focus Extraction with Conversational Safety Filter
    const STOPWORDS_AND_FILLERS = new Set([
      'yeah', 'yes', 'no', 'one', 'two', 'three', 'now', 'and', 'this', 'that', 'these', 'those',
      'here', 'there', 'today', 'tomorrow', 'yesterday', 'first', 'second', 'next', 'then',
      'so', 'let', 'well', 'okay', 'right', 'like', 'also', 'just', 'because', 'therefore',
      'document', 'suppose', 'consider', 'good', 'morning', 'afternoon', 'evening', 'everyone',
      'please', 'thank', 'thanks', 'hello', 'hi', 'class', 'students', 'look', 'see', 'mean',
      'means', 'say', 'saying', 'said', 'tell', 'talk', 'discuss', 'approach', 'problem',
      'give', 'gives', 'take', 'takes', 'make', 'makes', 'come', 'comes', 'go', 'going',
      'we', 'you', 'they', 'our', 'my', 'your', 'his', 'her', 'its', 'their', 'the', 'a', 'an',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
      'should', 'can', 'could', 'may', 'might', 'must', 'something', 'anything', 'nothing'
    ]);

    const technicalPatterns = [
      /\b(binary search)\b/gi,
      /\b(sorted array(?:s)?)\b/gi,
      /\b(median(?: of two sorted arrays)?)\b/gi,
      /\b(time complexity)\b/gi,
      /\b(space complexity)\b/gi,
      /\b(partition(?: condition|ing)?)\b/gi,
      /\b(logarithmic time)\b/gi,
      /\b(binary tree(?:s)?)\b/gi,
      /\b(binary search tree(?:s)?|bst)\b/gi,
      /\b(dynamic programming)\b/gi,
      /\b(depth first search|breadth first search|dfs|bfs)\b/gi,
      /\b(merge sort|quick sort|heap sort|bubble sort)\b/gi,
      /\b(linked list(?:s)?)\b/gi,
      /\b(hash table(?:s)?|hash map(?:s)?)\b/gi,
      /\b(recursion|recursive)\b/gi,
      /\b(asymptotic analysis|big o notation)\b/gi,
      /\b(rest api|microservice(?:s)?|database indexing)\b/gi,
      /\b(neural network(?:s)?|tokenization|transformer)\b/gi,
      /\b(concurrency|multithreading|deadlock|semaphore)\b/gi,
      /\b(event loop|microtask|callback queue|promise)\b/gi,
      /\b(memory allocation|stack pointer|interrupt vector)\b/gi
    ];

    const candidateScores = new Map();

    // A. Match defined technical n-grams
    for (const pattern of technicalPatterns) {
      const matches = raw.match(pattern);
      if (matches) {
        const cleanTerm = matches[0].split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        candidateScores.set(cleanTerm, (candidateScores.get(cleanTerm) || 0) + matches.length * 4);
      }
    }

    // B. Extract mid-sentence capitalized terms and multi-word proper terms (avoids sentence-initial words)
    const midSentenceCapRegex = /(?:[a-z0-9,;]\s+)([A-Z][a-zA-Z0-9_]{2,}(?:\s+[A-Z][a-zA-Z0-9_]{2,})*)/g;
    let capMatch;
    while ((capMatch = midSentenceCapRegex.exec(raw)) !== null) {
      const term = capMatch[1].trim();
      const termLower = term.toLowerCase();
      const termWords = termLower.split(/\s+/);
      if (!termWords.some(w => STOPWORDS_AND_FILLERS.has(w)) && term.length >= 3) {
        candidateScores.set(term, (candidateScores.get(term) || 0) + 2);
      }
    }

    // C. Extract domain keywords from academic indicators that appear with strong frequency
    const domainKeywords = [
      'partition', 'median', 'algorithm', 'complexity', 'array', 'pointer',
      'recursion', 'traversal', 'tree', 'graph', 'matrix', 'stack', 'queue',
      'sorting', 'indexing', 'register', 'interrupt', 'pipeline', 'cache',
      'asynchronous', 'closure', 'middleware', 'endpoint', 'schema'
    ];
    for (const word of domainKeywords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = raw.match(regex);
      if (matches && matches.length >= 1) {
        const formatted = word.charAt(0).toUpperCase() + word.slice(1);
        const alreadyCovered = Array.from(candidateScores.keys()).some(k => k.toLowerCase().includes(word));
        if (!alreadyCovered) {
          candidateScores.set(formatted, (candidateScores.get(formatted) || 0) + matches.length);
        }
      }
    }

    const detectedFocus = Array.from(candidateScores.entries())
      .filter(([term]) => !STOPWORDS_AND_FILLERS.has(term.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .slice(0, 6);

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
