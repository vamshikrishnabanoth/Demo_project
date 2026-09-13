"""
Deterministic Patch Engine: Applies localized surgical field mutations
to ProductionMCQ objects while guaranteeing non-defective fields remain untouched.
"""

from typing import Tuple
from production_engine.schemas import ProductionMCQ
from production_engine.experimental.critic_repair.schemas import TargetedJSONPatch


class PatchEngine:
    """Deterministically applies targeted field patches to an MCQ instance."""

    ALL_FIELDS = [
        "question_text", "option_a", "option_b", "option_c", "option_d",
        "correct_option", "explanation", "what_taught", "misconception_rationale"
    ]

    @classmethod
    def apply_patch(
        cls,
        original_mcq: ProductionMCQ,
        patch: TargetedJSONPatch
    ) -> Tuple[ProductionMCQ, int]:
        """
        Applies surgical field replacement.
        Returns (patched_mcq, count_of_preserved_fields).
        """
        mcq_dict = original_mcq.model_dump()
        target_field = patch.target_field

        if target_field not in mcq_dict:
            raise ValueError(f"Field '{target_field}' does not exist on ProductionMCQ schema.")

        # Mutate ONLY the target field
        mcq_dict[target_field] = patch.replacement_content.strip()

        patched_mcq = ProductionMCQ(**mcq_dict)

        # Count preserved fields
        preserved_count = 0
        for f in cls.ALL_FIELDS:
            if f != target_field and getattr(patched_mcq, f) == getattr(original_mcq, f):
                preserved_count += 1

        return patched_mcq, preserved_count
