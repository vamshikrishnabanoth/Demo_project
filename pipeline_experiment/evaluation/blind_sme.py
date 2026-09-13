"""
Blind Subject Matter Expert (SME) Packager.
Shuffles and anonymizes question items into blind codes (Q_BLIND_001...) across Summary and Blueprint suites.
"""

import random
from typing import List, Dict, Any, Tuple
from pipeline_experiment.shared.schemas.canonical_models import MCQSuite, MCQItem, SMEMCQEvaluationRecord


class BlindSMEPackager:
    @staticmethod
    def create_blind_packet(
        suite_a: MCQSuite,
        suite_b: MCQSuite,
        seed: int = 42
    ) -> Dict[str, Any]:
        """
        Creates an anonymized, randomized question packet and private decryption key.
        """
        random.seed(seed)
        all_items = []
        key_map = {}

        for suite, pipeline_label in [(suite_a, "PIPELINE_A_SUMMARY"), (suite_b, "PIPELINE_B_BLUEPRINT")]:
            for q in suite.questions:
                blind_id = f"Q_BLIND_{random.randint(1000, 9999)}"
                while blind_id in key_map:
                    blind_id = f"Q_BLIND_{random.randint(1000, 9999)}"

                key_map[blind_id] = {
                    "original_id": q.question_id,
                    "pipeline": pipeline_label,
                    "input_id": suite.input_id,
                    "target_concept": q.target_concept,
                    "cognitive_level": q.cognitive_level
                }

                all_items.append({
                    "blind_id": blind_id,
                    "question_text": q.question_text,
                    "options": {
                        "A": q.option_a,
                        "B": q.option_b,
                        "C": q.option_c,
                        "D": q.option_d
                    },
                    "correct_option": q.correct_option,
                    "explanation": q.explanation
                })

        random.shuffle(all_items)

        return {
            "input_id": suite_a.input_id,
            "blind_questions": all_items,
            "private_decryption_key": key_map
        }
