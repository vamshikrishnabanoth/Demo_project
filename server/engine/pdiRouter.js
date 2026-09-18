/**
 * server/engine/pdiRouter.js
 *
 * Production 3-Way Representation Router.
 * Determines whether to route to Summary (WHAT), Blueprint (WHY), or Unified (WHAT + WHY)
 * based on 6 observable upfront input features.
 * Exact JavaScript port of production_engine/router.py.
 */

'use strict';

class PdiRouter {
  constructor() {
    this.PEDAGOGICAL_CUES = [
      /\bremember\b/i, /\bimportant\b/i, /\bnote that\b/i, /\bpay attention\b/i,
      /\bkey point\b/i, /\bmistake\b/i, /\bdon'?t forget\b/i, /\bexam\b/i,
      /\brule of thumb\b/i, /\bnotice how\b/i, /\bcareful\b/i, /\bcritical\b/i
    ];

    this.DIALOGUE_CUES = [
      /\bany questions\b/i, /\bunderstand\b/i, /\byes sir\b/i, /\byes ma'?am\b/i,
      /\bright\?/i, /\bgot it\b/i, /\bwho can tell\b/i, /\bwhat happens if\b/i,
      /\bwhat is the answer\b/i, /\bwhy is that\b/i, /\bdo you agree\b/i
    ];

    this.CODE_PATTERNS = [
      /def\s+\w+\(/, /function\s+\w+\(/, /#include\s*</, /import\s+\w+/,
      /for\s*\([^)]*\)/, /while\s*\([^)]*\)/, /console\.log\(/, /printf\(/,
      /return\s+[^;]+;/, /db\.\w+\./, /public\s+class\s+\w+/
    ];
  }

  /**
   * Extract 6 upfront instructional and modality features from raw session inputs.
   */
  extractFeatures(sessionInputs = {}) {
    const voiceText = sessionInputs.voiceTranscript || '';
    const docsText = (sessionInputs.documentTexts || []).join('\n');
    const codeText = sessionInputs.codeSnippets || '';
    const imageText = (sessionInputs.imageTexts || []).join('\n');

    const text = `${voiceText}\n${docsText}\n${codeText}\n${imageText}`;
    const words = text.match(/\b\w+\b/g) || [];
    const word_count = Math.max(1, words.length);

    const has_audio = Boolean(voiceText && voiceText.trim().length > 0);
    const has_ppt = Boolean(docsText && docsText.trim().length > 50);

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const total_lines = Math.max(1, lines.length);

    const code_count = lines.filter(l => {
      return this.CODE_PATTERNS.some(pat => pat.test(l)) ||
        l.startsWith('{') || l.startsWith('}') || l.startsWith('/*') ||
        l.startsWith('//') || l.startsWith('```') || l.startsWith('$');
    }).length;

    const code_density = Number(Math.min(1.0, code_count / total_lines).toFixed(3));

    let ped_count = 0;
    for (const pat of this.PEDAGOGICAL_CUES) {
      const matches = text.match(new RegExp(pat.source, 'gi'));
      if (matches) ped_count += matches.length;
    }
    const ped_density = Number(((ped_count / word_count) * 1000.0).toFixed(2));

    let dialogue_count = 0;
    for (const pat of this.DIALOGUE_CUES) {
      const matches = text.match(new RegExp(pat.source, 'gi'));
      if (matches) dialogue_count += matches.length;
    }
    const dialogue_density = Number(((dialogue_count / word_count) * 1000.0).toFixed(2));

    return {
      has_audio,
      has_ppt,
      code_density,
      text_length_words: word_count,
      pedagogical_marker_density: ped_density,
      dialogue_interaction_density: dialogue_density
    };
  }

  /**
   * Deterministic, explainable 3-way representation router.
   */
  route(sessionInputs = {}) {
    const feats = this.extractFeatures(sessionInputs);

    const audio_signal = feats.has_audio ? 1.0 : 0.0;
    const ppt_signal = feats.has_ppt ? 1.0 : 0.0;
    const dialogue_signal = Math.min(1.0, feats.dialogue_interaction_density / 1.5);
    const ped_marker_signal = Math.min(1.0, feats.pedagogical_marker_density / 1.0);
    const static_code_penalty = feats.code_density * (1.0 - audio_signal);

    const pdi = Number((
      (0.50 * audio_signal) +
      (0.30 * ppt_signal) +
      (0.15 * dialogue_signal) +
      (0.05 * ped_marker_signal) -
      (0.30 * static_code_penalty)
    ).toFixed(3));

    let choice = 'SUMMARY';
    let rationale = '';

    // 3-Way Production Decision Rule (exact match to Python)
    if (feats.has_audio && feats.has_ppt) {
      choice = 'UNIFIED';
      rationale = `Multimodal Classroom (Audio + PPT/Code with PDI=${pdi.toFixed(3)}): Requires Unified Synthesis of technical slide concepts (WHAT) and spoken teacher emphasis (WHY).`;
    } else if (pdi >= 0.60) {
      choice = 'BLUEPRINT';
      rationale = `High Pedagogical Delivery Index (PDI=${pdi.toFixed(3)} >= 0.60): Strong live interactive teaching and emphasis signals detected without slides. Routed to Instructional Blueprint.`;
    } else {
      choice = 'SUMMARY';
      rationale = `PDI=${pdi.toFixed(3)} < 0.60: Material is predominantly static, code-dense, or monologue exposition. Routed to Technical Summary.`;
    }

    return {
      selected_representation: choice,
      pedagogical_delivery_index: pdi,
      rationale,
      features: feats
    };
  }
}

module.exports = new PdiRouter();
