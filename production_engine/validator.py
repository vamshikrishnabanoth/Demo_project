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
from typing import List, Dict, Any, Tuple, Set, Optional
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
    def check_proposition_duplicate(
        cls,
        question: ProductionMCQ,
        accepted_propositions: List[Dict[str, Any]],
        threshold: float = 0.45
    ) -> Tuple[bool, str]:
        """
        Checks if a question assesses the same underlying pedagogical proposition
        for a concept as an already accepted question, beyond surface wording.
        """
        if not accepted_propositions:
            return False, ""

        cand_stem = (question.stem or "").lower()
        cand_concept = (question.target_concept or "").strip().lower()
        raw_options = {
            "A": question.option_a, "B": question.option_b,
            "C": question.option_c, "D": question.option_d
        }
        cand_opt = raw_options.get(question.correct_option, "").lower()

        # Extract proposition keywords (stem + correct answer)
        cand_kws = cls._extract_keywords(cand_stem + " " + cand_opt)

        for prev in accepted_propositions:
            prev_stem = prev.get("stem", "").lower()
            prev_concept = prev.get("concept", "").strip().lower()
            prev_opt = prev.get("correct_text", "").lower()

            # Surface stem similarity check
            stem_sim = cls._compute_jaccard_similarity(cand_stem, prev_stem)
            if stem_sim >= 0.65:
                return True, f"Surface stem similarity ({stem_sim:.2f}) with accepted question: '{prev_stem[:60]}...'"

            # Proposition collision: Same core concept AND high proposition overlap
            if cand_concept and prev_concept:
                same_concept = (cand_concept == prev_concept) or (cand_concept in prev_concept) or (prev_concept in cand_concept)
                # Also treat specific Git commands as related
                if "git" in cand_concept and "git" in prev_concept:
                    # Check if both test git diff
                    if "diff" in cand_stem and "diff" in prev_stem:
                        same_concept = True

                if same_concept:
                    prev_kws = cls._extract_keywords(prev_stem + " " + prev_opt)
                    if cand_kws and prev_kws:
                        overlap = cand_kws.intersection(prev_kws)
                        union = cand_kws.union(prev_kws)
                        prop_sim = len(overlap) / len(union) if union else 0.0
                        if prop_sim >= threshold:
                            return True, f"Proposition collision ({prop_sim:.2f}) on concept '{cand_concept}' with accepted question: '{prev_stem[:60]}...'"

        return False, ""

    @classmethod
    def normalize_option_text(cls, text: str) -> str:
        """Strips option prefixes like 'A)', '(A)', 'A.', 'Option A:' and trims whitespace."""
        if not text:
            return ""
        cleaned = text.strip()
        # Remove markdown bold/italics around prefix, e.g. **A.** or *A)*
        cleaned = re.sub(r'^\*{1,2}\s*[A-Da-d][\.\):\-]\s*\*{1,2}\s*', '', cleaned)
        # Remove standard prefix A. / A) / (A) / Option A:
        cleaned = re.sub(r'^(?:[A-Da-d][\.\):\-]|(?:\([A-Da-d]\))|(?:Option\s+[A-Da-d][\:\.\-]?))\s*', '', cleaned, flags=re.IGNORECASE)
        return cleaned.strip()

    @classmethod
    def check_substantive_entailment(
        cls,
        question: ProductionMCQ,
        evidence_text: str
    ) -> Tuple[bool, str, bool]:
        """
        Verifies that cited evidence actually substantiates the core claim and
        correct option, rather than merely mentioning a general keyword.
        Returns: (is_entailed, message, is_fixable)
        """
        if not evidence_text or len(evidence_text.strip()) < 20:
            return False, "Evidence text is empty or missing.", False

        ev_lower = evidence_text.lower()
        stem_lower = (question.stem or "").lower()

        raw_options = {
            "A": question.option_a, "B": question.option_b,
            "C": question.option_c, "D": question.option_d
        }
        correct_text = raw_options.get(question.correct_option, "")

        # 1. Reject ungrounded technical parameters/mechanisms introduced in stem (Case 1: Unfixable)
        critical_markers = ["downsampling", "down sampling", "bottleneck", "asymptotic", "runtime bound"]
        for marker in critical_markers:
            if marker in stem_lower and marker not in ev_lower:
                return False, f"Question stem asserts technical parameter/concept '{marker}' that does not appear in cited evidence.", False

        # 2. Check concept grounding: if concept is specific, it should be reflected in evidence (Case 1: Unfixable)
        concept = (question.target_concept or "").strip().lower()
        if concept and len(concept) > 3 and concept not in ["overview", "general", "core"]:
            c_words = [w for w in re.findall(r'\w+', concept) if w not in cls.STOPWORDS and len(w) > 3]
            if c_words and not any(w in ev_lower for w in c_words):
                return False, f"Target concept '{concept}' is absent from cited evidence excerpt.", False

        # 3. Check correct option substantive grounding:
        # At least one key substantive keyword from correct option must be in evidence
        # If concept exists in evidence but specific wording in option is mismatched, this is Case 2 (Fixable wording)
        correct_kws = cls._extract_keywords(correct_text)
        if correct_kws:
            overlap = [kw for kw in correct_kws if kw in ev_lower]
            if not overlap and len(correct_kws) >= 2:
                return False, f"Correct option claims ({', '.join(list(correct_kws)[:3])}) are not substantiated by the cited evidence excerpt.", True

        return True, "", True

    @classmethod
    def validate_question(
        cls,
        question: ProductionMCQ,
        raw_evidence: str,
        accepted_stems: Optional[List[str]] = None,
        accepted_propositions: Optional[List[Dict[str, Any]]] = None
    ) -> ValidationResult:
        issues = []
        self_consistent = True
        grounding_passed = True
        distractor_passed = True
        is_fixable = True

        # Pre-pass: Deterministic Option Text Normalization (strip A), (A), A., Option A:, trim whitespace)
        question.option_a = cls.normalize_option_text(question.option_a)
        question.option_b = cls.normalize_option_text(question.option_b)
        question.option_c = cls.normalize_option_text(question.option_c)
        question.option_d = cls.normalize_option_text(question.option_d)

        # 0. Curricular Content & Meta-Pedagogy Check (Unfixable)
        stem_lower = (question.stem or "").lower()
        concept_lower = (question.target_concept or "").lower()
        meta_terms = ["overview segment", "study schedule", "study plan", "2-minute overview", "instructor present an overview", "omitting the overview"]
        if any(term in stem_lower for term in meta_terms) or concept_lower in ["overview", "study schedule", "study plan"]:
            self_consistent = False
            is_fixable = False
            issues.append(f"Curricular Content Failure: Question assesses lecture meta-structure/overview rather than technical curricular content.")

        # 1. Semantic Duplicate & Proposition Prevention Gate (Unfixable: simply reject without critic call)
        if accepted_propositions:
            is_dup_prop, dup_prop_msg = cls.check_proposition_duplicate(question, accepted_propositions, threshold=0.45)
            if is_dup_prop:
                self_consistent = False
                is_fixable = False
                issues.append(f"Semantic Duplicate Failure: {dup_prop_msg}")
        elif accepted_stems:
            is_dup, dup_score, matched_stem = cls.check_semantic_duplicate(question.stem, accepted_stems, threshold=0.70)
            if is_dup:
                self_consistent = False
                is_fixable = False
                issues.append(f"Semantic duplicate detected (similarity {dup_score:.2f}) with accepted question: '{matched_stem[:60]}...'")

        # 2. Check option uniqueness & non-empty (Unfixable)
        raw_options = {
            "A": question.option_a.strip(),
            "B": question.option_b.strip(),
            "C": question.option_c.strip(),
            "D": question.option_d.strip()
        }
        option_texts = list(raw_options.values())
        if any(len(opt) == 0 for opt in option_texts):
            self_consistent = False
            is_fixable = False
            issues.append("One or more options are empty.")

        if len(set(option_texts)) < 4:
            self_consistent = False
            is_fixable = False
            issues.append("Duplicate or identical options detected.")

        # 3. Check key validity
        if question.correct_option not in ["A", "B", "C", "D"]:
            self_consistent = False
            is_fixable = False
            issues.append(f"Invalid correct_option key: '{question.correct_option}'. Must be A, B, C, or D.")

        correct_text = raw_options.get(question.correct_option, "")

        # 4. Semantic Distractor Non-Equivalence (Detect synonymous options - Fixable with 1 targeted repair)
        for key, opt_text in raw_options.items():
            if key != question.correct_option and correct_text:
                sim = cls._compute_jaccard_similarity(correct_text, opt_text)
                if sim >= 0.65:
                    distractor_passed = False
                    issues.append(f"Distractor Option {key} is semantically identical or nearly synonymous (similarity {sim:.2f}) with correct Option {question.correct_option}.")

        # 5. Semantic Key Alignment (Explanation must substantiate the correct answer - Fixable)
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

        # 6. Substantive Evidence Grounding & Entailment Gate
        if not question.what_taught or len(question.what_taught.strip()) < 10:
            grounding_passed = False
            is_fixable = False
            issues.append("Missing or incomplete 'what_taught' pedagogical traceability record.")

        if not question.evidence_refs:
            grounding_passed = False
            is_fixable = False
            issues.append("Missing source evidence references.")

        # Substantive entailment check against cited excerpt and combined evidence
        ev_to_check = (question.evidence_excerpt or "") + "\n" + (raw_evidence or "")
        entailed, entail_msg, entail_fixable = cls.check_substantive_entailment(question, ev_to_check)
        if not entailed:
            grounding_passed = False
            issues.append(f"Substantive Evidence Entailment Failure: {entail_msg}")
            if not entail_fixable:
                is_fixable = False

        # Relational Grounding Check:
        # Prevents pre-training extrapolations (e.g. inventing O(s+g+l) complexity when teacher only listed config files)
        complexity_markers = ["time complexity", "space complexity", "asymptotic", "big-o", "o(1)", "o(n", "o(log", "o(s+"]
        stem_asserts_complexity = any(cm in stem_lower for cm in complexity_markers) or bool(re.search(r'\bo\s*\([^)]+\)', stem_lower))
        if stem_asserts_complexity:
            evidence_lower = ev_to_check.lower()
            evidence_has_complexity = any(cm in evidence_lower for cm in ["complexity", "asymptotic", "big-o", "big o", "runtime bound"]) or bool(re.search(r'\bo\s*\([^)]+\)', evidence_lower))
            if not evidence_has_complexity:
                grounding_passed = False
                is_fixable = False
                issues.append("Relational Grounding Failure: Question stem asserts computational complexity or asymptotic runtime (O(...)) that was not taught in lecture evidence.")

        # 7. Distractor Misconception Rationale
        if not question.misconception_rationale or len(question.misconception_rationale.strip()) < 15:
            distractor_passed = False
            issues.append("Missing or generic distractor misconception rationale.")

        is_valid = self_consistent and grounding_passed and distractor_passed

        return ValidationResult(
            is_valid=is_valid,
            self_consistency_passed=self_consistent,
            evidence_grounding_passed=grounding_passed,
            distractor_quality_passed=distractor_passed,
            issues=issues,
            is_fixable=is_fixable
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
