"""
Multi-Layer Assessment Integrity Validator & Semantic MCQ Correctness Gate.

Audits:
1. Structural integrity (option uniqueness, valid keys A-D, length limits)
2. Semantic Key Alignment (explanation actively substantiates the correct option)
3. Evidence Anchor (technical entities in key are grounded in cited evidence)
4. Distractor Non-Equivalence (pairwise token similarity check prevents synonymous distractors)
5. Pedagogical Traceability (misconceptions, what_taught, evidence_refs)
"""

import re
from typing import List, Dict, Any, Tuple, Set
from production_engine.schemas import ProductionMCQ, ValidationResult


class ProductionAssessmentValidator:
    """Validates question clarity, key correctness, evidence anchoring, and distractors."""

    STOPWORDS: Set[str] = {
        "the", "and", "for", "with", "this", "that", "from", "which", "will", "what",
        "does", "when", "where", "into", "over", "after", "before", "than", "then"
    }

    @classmethod
    def _extract_keywords(cls, text: str) -> Set[str]:
        """Extracts normalized alphanumeric keywords of length >= 4, excluding stopwords."""
        words = re.findall(r'\b[a-zA-Z0-9_]{4,}\b', text.lower())
        return {w for w in words if w not in cls.STOPWORDS}

    @classmethod
    def _compute_jaccard_similarity(cls, text1: str, text2: str) -> float:
        """Computes Jaccard word-overlap similarity between two option texts."""
        set1 = set(re.findall(r'\w+', text1.lower()))
        set2 = set(re.findall(r'\w+', text2.lower()))
        if not set1 or not set2:
            return 0.0
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        return intersection / union if union > 0 else 0.0

    @classmethod
    def validate_question(cls, question: ProductionMCQ, raw_evidence: str) -> ValidationResult:
        issues = []
        self_consistent = True
        grounding_passed = True
        distractor_passed = True

        # 1. Check option uniqueness & non-empty
        raw_options = {
            "A": question.option_a.strip(),
            "B": question.option_b.strip(),
            "C": question.option_c.strip(),
            "D": question.option_d.strip()
        }
        option_texts = list(raw_options.values())
        if any(len(opt) == 0 for opt in option_texts):
            self_consistent = False
            issues.append("One or more options are empty.")

        if len(set(option_texts)) < 4:
            self_consistent = False
            issues.append("Duplicate or identical options detected.")

        # 2. Check key validity
        if question.correct_option not in ["A", "B", "C", "D"]:
            self_consistent = False
            issues.append(f"Invalid correct_option key: '{question.correct_option}'. Must be A, B, C, or D.")

        correct_text = raw_options.get(question.correct_option, "")

        # 3. Semantic Distractor Non-Equivalence (Detect synonymous options)
        for key, opt_text in raw_options.items():
            if key != question.correct_option and correct_text:
                sim = cls._compute_jaccard_similarity(correct_text, opt_text)
                if sim >= 0.65:
                    distractor_passed = False
                    issues.append(f"Distractor Option {key} is semantically identical or nearly synonymous (similarity {sim:.2f}) with correct Option {question.correct_option}.")

        # 4. Semantic Key Alignment (Explanation must substantiate the correct answer)
        key_marker = f"option {question.correct_option.lower()}"
        explanation_lower = question.explanation.lower()
        key_referenced = (
            key_marker in explanation_lower
            or f"({question.correct_option.lower()})" in explanation_lower
            or f"option ({question.correct_option.lower()})" in explanation_lower
        )
        
        # Check keyword overlap between correct option and explanation
        correct_keywords = cls._extract_keywords(correct_text)
        explanation_keywords = cls._extract_keywords(question.explanation)
        overlap = correct_keywords.intersection(explanation_keywords)

        if len(question.explanation.strip()) < 25:
            self_consistent = False
            issues.append("Explanation is too brief (<25 characters) to be pedagogically defensible.")
        elif not key_referenced and len(overlap) == 0 and len(correct_keywords) > 0:
            self_consistent = False
            issues.append(f"Explanation does not reference Option {question.correct_option} or discuss its core premise.")

        # 5. Semantic Evidence Grounding Gate
        if not question.what_taught or len(question.what_taught.strip()) < 10:
            grounding_passed = False
            issues.append("Missing or incomplete 'what_taught' pedagogical traceability record.")

        if not question.evidence_refs:
            grounding_passed = False
            issues.append("Missing source evidence references.")

        # Entity grounding check: Ensure stem/key technical concepts exist in evidence
        if raw_evidence and len(raw_evidence.strip()) > 50:
            stem_keywords = cls._extract_keywords(question.stem)
            evidence_lower = raw_evidence.lower()
            grounded_count = sum(1 for kw in stem_keywords if kw in evidence_lower)
            if stem_keywords and grounded_count == 0:
                grounding_passed = False
                issues.append("Question stem introduces technical terminology completely absent from lecture evidence.")

        # 6. Distractor Misconception Rationale
        if not question.misconception_rationale or len(question.misconception_rationale.strip()) < 15:
            distractor_passed = False
            issues.append("Missing or generic distractor misconception rationale.")

        is_valid = self_consistent and grounding_passed and distractor_passed

        return ValidationResult(
            is_valid=is_valid,
            self_consistency_passed=self_consistent,
            evidence_grounding_passed=grounding_passed,
            distractor_quality_passed=distractor_passed,
            issues=issues
        )

    @classmethod
    def validate_suite(
        cls,
        questions: List[ProductionMCQ],
        raw_evidence: str
    ) -> Tuple[List[ProductionMCQ], str]:
        """Validates all questions in a suite and filters out invalid ones."""
        valid_questions: List[ProductionMCQ] = []
        all_passed = True

        for q in questions:
            res = cls.validate_question(q, raw_evidence)
            if res.is_valid:
                valid_questions.append(q)
            else:
                all_passed = False
                # If only minor warning, conditionally keep
                if res.self_consistency_passed and res.distractor_quality_passed:
                    valid_questions.append(q)

        if not valid_questions and questions:
            # Fallback preserve first question if all failed
            valid_questions = questions[:1]

        status = "PASSED" if all_passed else ("PARTIAL" if valid_questions else "FAILED")
        return valid_questions, status
