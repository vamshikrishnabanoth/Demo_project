"""
Strict Shared MCQ Validator Engine.
Validates structural integrity, 4 distinct options, single valid key, and explanation quality.
"""

from typing import Tuple, List, Dict, Any, Optional
from pipeline_experiment.shared.schemas.canonical_models import MCQSuite, MCQItem


class SharedMCQValidator:
    @staticmethod
    def validate_suite(suite: MCQSuite) -> Tuple[bool, List[str], MCQSuite]:
        """
        Validates the MCQSuite against strict quality and structural criteria.
        Returns: (is_valid, error_list, validated_suite)
        """
        errors = []

        if not suite.questions:
            errors.append("MCQSuite contains 0 questions.")
            return False, errors, suite

        valid_questions: List[MCQItem] = []

        for idx, q in enumerate(suite.questions):
            q_errors = []

            # 1. Stem check
            if not q.question_text or len(q.question_text.strip()) < 10:
                q_errors.append(f"Q{idx+1}: Question stem is too short or empty.")

            # 2. Options check
            opts = [q.option_a.strip(), q.option_b.strip(), q.option_c.strip(), q.option_d.strip()]
            if any(not opt for opt in opts):
                q_errors.append(f"Q{idx+1}: One or more options are empty.")

            # 3. Distinct options check
            if len(set(opts)) < 4:
                q_errors.append(f"Q{idx+1}: Options contain duplicate text ({len(set(opts))} unique out of 4).")

            # 4. Correct option key check
            if q.correct_option not in ["A", "B", "C", "D"]:
                q_errors.append(f"Q{idx+1}: Invalid correct_option key '{q.correct_option}'. Must be A, B, C, or D.")

            # 5. Explanation check
            if not q.explanation or len(q.explanation.strip()) < 15:
                q_errors.append(f"Q{idx+1}: Explanation is missing or too brief.")

            if q_errors:
                errors.extend(q_errors)
            else:
                valid_questions.append(q)

        suite.questions = valid_questions
        suite.total_questions = len(valid_questions)
        is_valid = len(errors) == 0

        return is_valid, errors, suite
