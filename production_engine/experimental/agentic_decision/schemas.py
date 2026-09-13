"""
Schemas for Experiment 6: Controlled Autonomous Decision-Making & Agentic State-Machine Benchmark.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


AgentActionType = Literal[
    "DIRECT_GENERATE",
    "EXPAND_COGNITIVE_FACETS",
    "DEDUPLICATE_TARGETS",
    "TRIGGER_CROSS_MATERIAL_ENRICHMENT",
    "EXPAND_TO_PARENT_WINDOW",
    "SURGICAL_FIELD_PATCH",
    "TARGETED_ITEM_REGENERATION",
    "ESCALATE_TO_REGENERATION",
    "DELIVER_MAX_DEFENSIBLE_WITH_NOTICE",
    "TERMINATE_NON_ACADEMIC"
]


class AgenticState(BaseModel):
    state_id: str
    input_id: str
    requested_count: int
    requested_difficulty: str
    is_academic: bool = True
    available_concepts_count: int = 0
    available_evidence_ids: List[str] = Field(default_factory=list)
    has_slides: bool = False
    has_spoken_audio: bool = False
    current_targets_count: int = 0
    allocated_facets: List[str] = Field(default_factory=list)
    generated_questions_count: int = 0
    validated_questions_count: int = 0
    failed_items_count: int = 0
    current_defect_field: Optional[str] = None
    is_structural_defect: bool = False
    repair_attempts: int = 0
    max_repair_attempts: int = 2
    termination_reason: Optional[str] = None


class DecisionEvaluationResult(BaseModel):
    scenario_id: str
    description: str
    input_state: AgenticState
    expected_action: AgentActionType
    autonomous_action_chosen: AgentActionType
    is_decision_correct: bool
    unnecessary_action_flag: bool
    state_consistency_verified: bool
    loop_terminated_cleanly: bool
    action_execution_notes: str
