"""
Symmetrical Shared MCQ Generator Prompt Builder.
Guarantees that Pipeline A (Summary) and Pipeline B (Blueprint) receive identical prompt scaffolding and task instructions.
"""

from typing import Dict, Any, List
import json
from pipeline_experiment.shared.schemas.canonical_models import (
    PedagogicalSummary,
    AssessmentSlot,
    MCQSuite
)


class SymmetricalPromptBuilder:
    SHARED_SYSTEM_PROMPT = (
        "You are an expert Computer Science educator creating Multiple Choice Questions (MCQs) for an examination.\n"
        "Your task is to generate high-quality, 4-option multiple-choice questions grounded strictly in the provided educational representation.\n"
        "Each question MUST satisfy:\n"
        "1. A clear, unambiguous question stem.\n"
        "2. Exactly 4 distinct options (option_a, option_b, option_c, option_d).\n"
        "3. Exactly one unambiguous correct option (A, B, C, or D).\n"
        "4. A detailed pedagogical explanation justifying why the correct option is right and why each distractor is incorrect.\n"
        "5. Realistic distractors reflecting plausible student errors or misconceptions."
    )

    @classmethod
    def build_summary_prompt(
        cls,
        summary: PedagogicalSummary,
        question_count: int = 5,
        title: str = "Educational Material",
        input_type: str = "NOTES",
        content_style: str = "THEORY"
    ) -> str:
        """Constructs generator prompt for Pipeline A (Summary)."""
        summary_payload = {
            "title": summary.title,
            "concepts_and_definitions": summary.concepts_and_definitions,
            "mechanisms_and_formulas": summary.mechanisms_and_formulas,
            "examples_and_code_patterns": summary.examples_and_code_patterns,
            "factual_summary": summary.factual_summary_text
        }
        
        representation_str = json.dumps(summary_payload, indent=2)

        return (
            f"Material Title: {title}\n"
            f"Input Type: {input_type} | Content Style: {content_style}\n"
            f"Target Question Count: {question_count}\n\n"
            f"======================= INPUT REPRESENTATION: SUMMARY =======================\n"
            f"{representation_str}\n\n"
            f"============================ TASK INSTRUCTION ===============================\n"
            f"Generate exactly {question_count} MCQs grounded strictly in the provided Summary representation.\n"
            f"Adhere strictly to the MCQSuite JSON schema."
        )

    @classmethod
    def build_blueprint_prompt(
        cls,
        slots: List[AssessmentSlot],
        question_count: int = 5,
        title: str = "Educational Material",
        input_type: str = "NOTES",
        content_style: str = "THEORY"
    ) -> str:
        """Constructs generator prompt for Pipeline B (Blueprint Assessment Slots)."""
        slots_payload = [slot.model_dump() for slot in slots]
        representation_str = json.dumps(slots_payload, indent=2)

        return (
            f"Material Title: {title}\n"
            f"Input Type: {input_type} | Content Style: {content_style}\n"
            f"Target Question Count: {question_count}\n\n"
            f"======================= INPUT REPRESENTATION: BLUEPRINT SLOTS ===============\n"
            f"{representation_str}\n\n"
            f"============================ TASK INSTRUCTION ===============================\n"
            f"Generate exactly {question_count} MCQs grounded strictly in the provided Blueprint Slots representation.\n"
            f"For each slot, generate one question matching its assessment_goal, cognitive_level, and misconception_target.\n"
            f"Adhere strictly to the MCQSuite JSON schema."
        )

    @classmethod
    def build_unified_prompt(
        cls,
        plan: "UnifiedAssessmentPlan",
        question_count: int = 5,
        title: str = "Educational Material",
        input_type: str = "NOTES",
        content_style: str = "THEORY"
    ) -> str:
        """Constructs generator prompt for Pipeline C (Unified Dual-Model WHAT + WHY)."""
        targets_payload = [target.model_dump() for target in plan.assessment_targets]
        representation_str = json.dumps(targets_payload, indent=2)

        return (
            f"Material Title: {title}\n"
            f"Input Type: {input_type} | Content Style: {content_style}\n"
            f"Target Question Count: {question_count}\n\n"
            f"======================= INPUT REPRESENTATION: UNIFIED ASSESSMENT TARGETS (WHAT + WHY) =======\n"
            f"{representation_str}\n\n"
            f"============================ TASK INSTRUCTION ===============================\n"
            f"Generate exactly {question_count} MCQs grounded in the provided Unified Assessment Targets.\n"
            f"For each allocated question, fulfill the target's:\n"
            f"- what_taught_summary (Use the exact technical definitions, formulas, or code patterns)\n"
            f"- why_assessed_pedagogy (Focus on the teacher's instructional emphasis)\n"
            f"- target_bloom_level (Match the specified cognitive depth)\n"
            f"- misconception_distractor_hints (Embed realistic student misconceptions into the 3 distractors)\n\n"
            f"Adhere strictly to the MCQSuite JSON schema."
        )
