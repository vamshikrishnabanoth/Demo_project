"""
Pedagogical STT Accuracy Evaluator.
Evaluates fine-grained transcription reliability beyond raw WER:
1. Overall WER / CER
2. Technical-Term Accuracy
3. Number & Formula Accuracy
4. Negation Accuracy (preservation of 'not', 'don't', 'never', 'cannot')
5. Omission Rate of Pedagogically Critical Statements
"""

import re
from typing import Dict, Any, List, Set, Tuple
import jiwer


class PedagogicalSTTEvaluator:
    NEGATION_WORDS = {"not", "don't", "dont", "never", "cannot", "cant", "can't", "no", "neither", "nor", "won't", "wont"}

    @classmethod
    def evaluate_transcript(
        cls,
        ground_truth_text: str,
        hypothesis_transcript: str,
        domain_keywords: List[str] = None
    ) -> Dict[str, Any]:
        """
        Computes fine-grained pedagogical STT accuracy metrics.
        """
        gt_clean = cls._normalize(ground_truth_text)
        hyp_clean = cls._normalize(hypothesis_transcript)

        # 1. Standard Error Metrics
        wer = round(float(jiwer.wer(gt_clean, hyp_clean)), 4)
        cer = round(float(jiwer.cer(gt_clean, hyp_clean)), 4)

        # 2. Negation Preservation Accuracy
        gt_negations = [w for w in gt_clean.split() if w in cls.NEGATION_WORDS]
        hyp_negations = [w for w in hyp_clean.split() if w in cls.NEGATION_WORDS]
        negation_accuracy = round(
            min(1.0, len(hyp_negations) / max(1, len(gt_negations))), 3
        ) if gt_negations else 1.0

        # 3. Number and Formula Preservation Accuracy
        gt_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", gt_clean)
        hyp_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", hyp_clean)
        number_matches = sum(1 for n in gt_numbers if n in hyp_numbers)
        number_accuracy = round(number_matches / max(1, len(gt_numbers)), 3) if gt_numbers else 1.0

        # 4. Technical Term Accuracy
        if domain_keywords:
            term_matches = sum(1 for term in domain_keywords if term.lower() in hyp_clean)
            term_accuracy = round(term_matches / max(1, len(domain_keywords)), 3)
        else:
            # Extract technical words (len >= 4 not in common English stop list)
            gt_terms = set(re.findall(r"\b[a-zA-Z]{5,}\b", gt_clean))
            hyp_terms = set(re.findall(r"\b[a-zA-Z]{5,}\b", hyp_clean))
            term_matches = len(gt_terms.intersection(hyp_terms))
            term_accuracy = round(term_matches / max(1, len(gt_terms)), 3) if gt_terms else 1.0

        # 5. Omission Rate of Pedagogical Statements
        # Sentences in GT missing > 50% words in hyp
        gt_sentences = [s.strip() for s in re.split(r"[.?!]+", ground_truth_text) if len(s.strip().split()) > 3]
        omitted_sentences = 0
        for sent in gt_sentences:
            s_words = set(re.findall(r"\b[a-zA-Z0-9]+\b", sent.lower()))
            overlap = s_words.intersection(set(re.findall(r"\b[a-zA-Z0-9]+\b", hyp_clean)))
            if len(overlap) / max(1, len(s_words)) < 0.40:
                omitted_sentences += 1
        omission_rate = round(omitted_sentences / max(1, len(gt_sentences)), 3) if gt_sentences else 0.0

        pedagogical_reliability_index = round(
            (0.30 * (1.0 - min(1.0, wer)))
            + (0.25 * term_accuracy)
            + (0.20 * number_accuracy)
            + (0.15 * negation_accuracy)
            + (0.10 * (1.0 - omission_rate)),
            3
        )

        return {
            "overall_wer": wer,
            "overall_cer": cer,
            "technical_term_accuracy": round(term_accuracy * 100, 1),
            "number_formula_accuracy": round(number_accuracy * 100, 1),
            "negation_accuracy": round(negation_accuracy * 100, 1),
            "omission_rate": round(omission_rate * 100, 1),
            "pedagogical_reliability_index": pedagogical_reliability_index
        }

    @staticmethod
    def _normalize(text: str) -> str:
        text = text.lower()
        text = re.sub(r"[^\w\s\.]", "", text)
        return re.sub(r"\s+", " ", text).strip()
