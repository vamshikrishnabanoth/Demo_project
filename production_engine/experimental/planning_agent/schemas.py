"""
Schemas for the Evidence-Aware Adaptive Assessment Planning Agent.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


AssessmentFacetType = Literal[
    "CONCEPT_UNDERSTANDING",     # Core conceptual definitions & fundamental mechanics
    "THEORETICAL_RATIONALE",     # Why design decisions were made (e.g., reparameterization trick, why log-variance)
    "CODE_INTERPRETATION",      # Tensor manipulation, API syntax, method signatures
    "OUTPUT_PREDICTION",        # Tracing execution output on concrete numerical/array inputs
    "ERROR_DIAGNOSIS",          # Invariant violation or bug diagnosis (e.g., A[i-1] > B[j])
    "BOUNDARY_EDGE_CASE",       # Empty partitions, extreme values, sentinel bounds (-inf, +inf)
    "PARAMETER_CHANGE",         # Behavioral changes under altered hyperparameters or dimensions
    "COMPLEXITY_ANALYSIS",      # Asymptotic time/space trade-offs (why min(m, n))
    "ARCHITECTURAL_COMPARISON", # Contrasting two paradigms (e.g., YOLO vs Fast R-CNN, VAE vs AE)
    "PRACTICAL_APPLICATION",    # Applying taught technique to realistic problem scenario
    "OFF_BY_ONE_ANALYSIS",      # Boundary indexing, partition shifts, integer division rounding (+1)
    "MISCONCEPTION_TARGETING"   # Targeting prevalent student conceptual traps
]


class AdaptiveAssessmentTarget(BaseModel):
    target_id: str
    concept_name: str
    assessment_facet: AssessmentFacetType
    what_taught: str
    why_assessed: str
    cognitive_level: Literal["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]
    difficulty_level: Literal["EASY", "MEDIUM", "HARD"]
    primary_evidence_id: str
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    plausible_misconceptions: List[str] = Field(default_factory=list)
    assigned_key: Optional[Literal["A", "B", "C", "D"]] = None


class AdaptiveAssessmentPlan(BaseModel):
    plan_id: str
    requested_count: int
    allocated_count: int
    requested_difficulty: str
    representation_used: str
    targets: List[AdaptiveAssessmentTarget]
    facet_distribution: Dict[str, int] = Field(default_factory=dict)
    cognitive_distribution: Dict[str, int] = Field(default_factory=dict)
    planning_strategy_notes: str = ""
