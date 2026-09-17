"""
Production Engine Schemas: End-to-End Pydantic Models for Adaptive Assessment.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


BloomsLevel = Literal[
    "REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"
]

InstructionalAct = Literal[
    "INTRODUCE", "EXPLAIN", "DEMONSTRATE", "REINFORCE",
    "PRACTICE", "COMPARE", "DEBUG", "APPLY"
]

RepresentationType = Literal[
    "SUMMARY", "BLUEPRINT", "UNIFIED"
]

DifficultyLevel = Literal[
    "EASY", "MEDIUM", "HARD", "MIXED"
]


class InputFeatures(BaseModel):
    has_audio: bool
    has_ppt: bool
    code_density: float
    text_length_words: int
    pedagogical_marker_density: float
    dialogue_interaction_density: float


class RoutingDecision(BaseModel):
    selected_representation: RepresentationType
    pedagogical_delivery_index: float
    rationale: str
    features: InputFeatures


class AssessmentTarget(BaseModel):
    target_id: str
    concept_name: str
    what_taught: str = Field(description="Exact technical definition, algorithm step, or code behavior taught")
    why_assessed: str = Field(description="Why this is instructionally valuable to test based on teacher emphasis")
    cognitive_level: BloomsLevel
    difficulty_level: DifficultyLevel = "MEDIUM"
    instructional_act: InstructionalAct = "EXPLAIN"
    evidence_refs: List[str] = Field(default_factory=list, description="Associated chunk IDs and timestamps")
    plausible_misconceptions: List[str] = Field(default_factory=list, description="Common student misconceptions to target in distractors")
    assigned_key: Optional[Literal["A", "B", "C", "D"]] = None


class ProductionAssessmentPlan(BaseModel):
    input_id: str
    representation_used: RepresentationType
    requested_question_count: int
    requested_difficulty: DifficultyLevel = "MIXED"
    maximum_defensible_capacity: int = Field(description="Maximum distinct, high-quality questions the content can support")
    allocated_question_count: int = Field(description="Final number of questions to generate (min of requested and capacity)")
    targets: List[AssessmentTarget]


from pydantic import BaseModel, Field, model_validator


class ProductionMCQ(BaseModel):
    question_id: str = "Q1"
    question_text: str = ""
    stem: Optional[str] = None
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: Literal["A", "B", "C", "D"] = "A"
    explanation: str = ""
    target_concept: str = ""
    cognitive_level: BloomsLevel = "UNDERSTAND"
    difficulty_level: DifficultyLevel = "MEDIUM"

    # Teacher-Grounding & Provenance Traceability Record
    target_id: str = Field(default="", description="Mapped target ID from planner")
    assigned_key: Optional[Literal["A", "B", "C", "D"]] = Field(default=None, description="Steered target key from planner")
    what_taught: str = Field(default="", description="What exact technical content was taught")
    why_assessed: str = Field(default="", description="Why the teacher emphasized this concept")
    evidence_refs: List[str] = Field(default_factory=list, description="Where in the transcript/slide this appears")
    evidence_excerpt: str = Field(default="", description="Exact transcript excerpt used to ground question")
    representation_used: str = Field(default="", description="Representation type: BLUEPRINT or SUMMARY")
    planner_decision: str = Field(default="", description="Planner pedagogical rationale")
    misconception_rationale: str = Field(default="", description="Why the distractors represent plausible student errors")

    @model_validator(mode="before")
    @classmethod
    def sync_stem_and_question_text(cls, values):
        if isinstance(values, dict):
            if "stem" in values and values["stem"] and not values.get("question_text"):
                values["question_text"] = values["stem"]
            elif "question_text" in values and values["question_text"] and not values.get("stem"):
                values["stem"] = values["question_text"]
        return values



class ValidationResult(BaseModel):
    is_valid: bool
    self_consistency_passed: bool
    evidence_grounding_passed: bool
    distractor_quality_passed: bool
    issues: List[str] = Field(default_factory=list)
    is_fixable: bool = True


class ProductionAssessmentSuite(BaseModel):
    input_id: str
    title: str
    representation_used: RepresentationType
    routing_rationale: str
    requested_count: int
    requested_difficulty: DifficultyLevel = "MIXED"
    defensible_capacity: int
    final_question_count: int
    questions: List[ProductionMCQ]
    validation_status: Literal["PASSED", "PARTIAL", "FAILED"]
    generation_metadata: Dict[str, Any] = Field(default_factory=dict)
