"""
Schemas for Closed-Loop Critic & Targeted Patch-Repair Agent.
"""

from typing import List, Dict, Any, Optional, Literal
from enum import Enum
from pydantic import BaseModel, Field
from production_engine.schemas import ProductionMCQ, ValidationResult


class DefectCategory(str, Enum):
    AMBIGUOUS_DISTRACTOR = "AMBIGUOUS_DISTRACTOR"       # Distractor is partially true or misleading
    DUPLICATE_OPTION = "DUPLICATE_OPTION"               # Two options are semantically identical
    EMPTY_OR_BRIEF_EXPLANATION = "EMPTY_EXPLANATION"    # Explanation < 30 chars or missing
    KEY_MISMATCH = "KEY_MISMATCH"                       # Explanation contradicts correct_option
    UNGROUNDED_STEM = "UNGROUNDED_STEM"                 # Stem introduces unmentioned terms
    STRUCTURAL_INCONSISTENCY = "STRUCTURAL_INCONSISTENCY" # Multi-field mutual contradiction


class TargetedJSONPatch(BaseModel):
    question_id: str
    target_field: Literal[
        "option_a", "option_b", "option_c", "option_d",
        "explanation", "question_text", "correct_option",
        "what_taught", "misconception_rationale"
    ]
    replacement_content: str = Field(description="The exact replacement string for the target field only")
    patch_rationale: str = Field(description="Why this specific surgical change fixes the validator failure")


class CriticDiagnosis(BaseModel):
    question_id: str
    defect_category: DefectCategory
    is_single_field_repairable: bool = Field(
        description="True if defect can be resolved by mutating a single field; False if multi-field escalation is needed"
    )
    root_cause_explanation: str
    surgical_patch: Optional[TargetedJSONPatch] = None
    escalation_reason: Optional[str] = None
    full_repaired_mcq: Optional[ProductionMCQ] = None


class RepairCycleResult(BaseModel):
    question_id: str
    initial_defect_issues: List[str]
    repair_strategy: Literal["SINGLE_FIELD_PATCH", "TARGETED_ITEM_REGENERATION", "FAILED_REPAIR"]
    attempts_taken: int
    final_validation_passed: bool
    repaired_mcq: ProductionMCQ
    patch_applied: Optional[TargetedJSONPatch] = None
    tokens_consumed: int
    latency_seconds: float
    fields_preserved_count: int
    is_pedagogically_correct: bool = True
